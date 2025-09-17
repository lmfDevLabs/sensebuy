export class VectorStoreAdapter {
  async upsert() {
    throw new Error('not implemented');
  }

  async similaritySearch() {
    throw new Error('not implemented');
  }

  async deleteByIds() {
    // optional override
  }
}

export async function makeVectorStoreAdapter() {
  const provider = (process.env.VECTORSTORE_PROVIDER || 'memory').toLowerCase();
  if (provider === 'pinecone') {
    const { PineconeVectorStoreAdapter } = await import('./pinecone.js');
    return new PineconeVectorStoreAdapter();
  }
  const { MemoryVectorStoreAdapter } = await import('./memory.js');
  return new MemoryVectorStoreAdapter();
}
