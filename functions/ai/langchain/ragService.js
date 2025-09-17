import { setupLangSmith } from './tracing.js';
import { makeVectorStoreAdapter } from './vectorstore/adapter.js';
import { makeRetriever } from './retrieval.js';
import { answerWithRag } from './rag.js';

setupLangSmith();

const vectorStorePromise = makeVectorStoreAdapter();
let retrieverInstance;

async function getRetriever() {
  if (!retrieverInstance) {
    const store = await vectorStorePromise;
    retrieverInstance = makeRetriever(store);
  }
  return retrieverInstance;
}

export async function runSemanticRag(query, options = {}) {
  if (!query) {
    throw new Error('query is required');
  }
  const retriever = await getRetriever();
  const contexts = await retriever.retrieve(query, options.k || 5);
  const answer = await answerWithRag(query, contexts, options);
  return { answer, contexts };
}

export async function retrieveContexts(query, options = {}) {
  const retriever = await getRetriever();
  return retriever.retrieve(query, options.k || 5);
}
