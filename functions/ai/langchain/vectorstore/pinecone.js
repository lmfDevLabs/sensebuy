import { Pinecone } from '@pinecone-database/pinecone';
import { OpenAIEmbeddings } from '@langchain/openai';
import { PineconeStore } from '@langchain/community/vectorstores/pinecone';
import { VectorStoreAdapter } from './adapter.js';

let storePromise;

export class PineconeVectorStoreAdapter extends VectorStoreAdapter {
  constructor() {
    super();
    if (!storePromise) {
      if (!process.env.PINECONE_API_KEY) {
        throw new Error('PINECONE_API_KEY is required for Pinecone vector store.');
      }
      if (!process.env.PINECONE_INDEX) {
        throw new Error('PINECONE_INDEX is required for Pinecone vector store.');
      }
      const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
      const index = client.Index(process.env.PINECONE_INDEX);
      const embeddings = new OpenAIEmbeddings({
        model: process.env.EMBED_MODEL || 'text-embedding-3-small',
      });
      storePromise = PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex: index,
      });
    }
    this.storePromise = Promise.resolve(storePromise);
  }

  async upsert(docs) {
    const store = await this.storePromise;
    const documents = docs.map((d) => ({
      pageContent: d.text,
      metadata: { id: d.id, ...(d.metadata || {}) },
    }));
    await store.addDocuments(documents, { ids: docs.map((d) => d.id) });
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
    await store.delete({ ids });
  }
}
