import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { Document } from '@langchain/core/documents';
import { VectorStoreAdapter } from './adapter.js';
import { makeEmbedder } from '../embeddings.js';

let singleton;

export class MemoryVectorStoreAdapter extends VectorStoreAdapter {
  constructor() {
    super();
    if (!singleton) {
      const embeddings = makeEmbedder();
      singleton = MemoryVectorStore.fromDocuments([], embeddings);
    }
    this.storePromise = Promise.resolve(singleton);
  }

  async upsert(docs) {
    const store = await this.storePromise;
    await this.deleteByIds(docs.map((d) => d.id));
    const mapped = docs.map(
      (d) =>
        new Document({
          pageContent: d.text,
          metadata: { id: d.id, ...(d.metadata || {}) },
        }),
    );
    await store.addDocuments(mapped);
  }

  async similaritySearch(query, k = 5) {
    const store = await this.storePromise;
    const results = await store.similaritySearchWithScore(query, k);
    return results.map(([doc, score]) => ({
      id: doc.metadata?.id,
      text: doc.pageContent,
      score,
      metadata: doc.metadata,
    }));
  }

  async deleteByIds(ids = []) {
    if (!ids.length) return;
    const store = await this.storePromise;
    store.memoryVectors = store.memoryVectors.filter(
      (item) => !ids.includes(item.metadata?.id),
    );
  }
}
