import { ai } from '../genkit/config.js';
import { textEmbedding004 } from '@genkit-ai/vertexai';

const BATCH_SIZE = parseInt(process.env.EMBED_BATCH_SIZE ?? '16', 10);
const QPM = parseInt(process.env.EMBED_QPM ?? '60', 10);
const CONCURRENCY = parseInt(process.env.EMBED_CONCURRENCY ?? '1', 10);
const MAX_RETRIES = parseInt(process.env.EMBED_RETRIES ?? '5', 10);
const BASE_DELAY = 500; // milliseconds
const FLUSH_INTERVAL = 1000; // milliseconds

const queue = [];
let active = 0;
let tokens = QPM;
let timer = null;

// Refill the token bucket every minute
setInterval(() => {
  tokens = QPM;
  processQueue();
}, 60 * 1000);

function scheduleFlush() {
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      processQueue();
    }, FLUSH_INTERVAL);
  }
}

async function processQueue() {
  if (active >= CONCURRENCY) return;
  if (!queue.length) return;
  if (tokens <= 0) {
    scheduleFlush();
    return;
  }

  const batch = queue.splice(0, BATCH_SIZE);
  active++;
  tokens--;

  const contents = batch.map((item) => item.content);
  let attempt = 0;

  while (true) {
    try {
      const res = await ai.embed({ embedder: textEmbedding004, content: contents });
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
