import { ai } from '../genkit/config.js';
import { openAI } from '@genkit-ai/compat-oai/openai';
import { db } from '../firebase/admin.js';

const openAiEmbedder = openAI.embedder('text-embedding-3-small');

const BATCH_SIZE = parseInt(process.env.EMBED_BATCH_SIZE ?? '16', 10);
const QPM = parseInt(process.env.EMBED_QPM ?? '60', 10);
const CONCURRENCY = parseInt(process.env.EMBED_CONCURRENCY ?? '1', 10);
const MAX_RETRIES = parseInt(process.env.EMBED_RETRIES ?? '5', 10);
const BASE_DELAY = 500; // milliseconds
const FLUSH_INTERVAL = 1000; // milliseconds

const queue = [];
let active = 0;
let timer = null;
let quotaBackoff = 0;
const quotaRef = db.collection('embeddingQuota').doc('global');

function scheduleFlush() {
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      processQueue();
    }, FLUSH_INTERVAL);
  }
}

async function tryConsumeToken() {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(quotaRef);
    const now = Date.now();
    let data = snap.exists ? snap.data() : { tokens: QPM, updatedAt: now };
    if (now - (data.updatedAt || 0) >= 60 * 1000) {
      data.tokens = QPM;
      data.updatedAt = now;
    }
    if (data.tokens <= 0) {
      tx.set(quotaRef, data);
      return false;
    }
    data.tokens -= 1;
    tx.set(quotaRef, data);
    return true;
  });
}

async function processQueue() {
  if (active >= CONCURRENCY) return;
  if (!queue.length) return;

  const hasToken = await tryConsumeToken();
  if (!hasToken) {
    const delay = BASE_DELAY * Math.pow(2, quotaBackoff) + Math.random() * BASE_DELAY;
    quotaBackoff = Math.min(quotaBackoff + 1, MAX_RETRIES);
    setTimeout(processQueue, delay);
    return;
  }
  quotaBackoff = 0;

  const batch = queue.splice(0, BATCH_SIZE);
  active++;

  const contents = batch.map((item) => item.content);
  let attempt = 0;

  while (true) {
    try {
      const res = await ai.embedMany({
        embedder: openAiEmbedder,
        content: contents,
      });
      res.forEach((r, i) => batch[i].resolve(r.embedding));
      break;
    } catch (err) {
      if (err?.message?.includes('429') && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY * Math.pow(2, attempt) + Math.random() * BASE_DELAY;
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
      } else {
        batch.forEach((req) => req.reject(err));
        break;
      }
    }
  }

  active--;
  if (queue.length) processQueue();
}

export function embedText(content) {
  return new Promise((resolve, reject) => {
    queue.push({ content, resolve, reject });
    if (queue.length >= BATCH_SIZE) {
      processQueue();
    } else {
      scheduleFlush();
    }
  });
}
