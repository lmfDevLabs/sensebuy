import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import admin from 'firebase-admin';
import { traceable } from 'langsmith/traceable';
import { setupLangSmith } from '../ai/langchain/tracing.js';
import { makeVectorStoreAdapter } from '../ai/langchain/vectorstore/adapter.js';

setupLangSmith();

const storePromise = makeVectorStoreAdapter();

const processChunkIndexing = onDocumentUpdated('chunksEmbeddings/{chunkId}', async (event) => {
  const beforeData = event.data?.before?.data();
  const afterSnap = event.data?.after;
  const afterData = afterSnap?.data();
  if (!afterData) return null;

  const status = afterData.embeddingStatus;
  if (status !== 'done') return null;

  const content = afterData.content;
  if (!content) return null;

  const beforeStatus = beforeData?.embeddingStatus;
  const beforeHash = beforeData?.embeddingHash;
  const currentHash = afterData.embeddingHash;
  const alreadyIndexed = Boolean(afterData.vectorIndexedAt);

  if (beforeStatus === 'done' && beforeHash === currentHash && alreadyIndexed) {
    return null;
  }

  const store = await storePromise;

  const tracedIndex = traceable(
    async ({ chunkId }) => {
      await store.upsert([
        {
          id: chunkId,
          text: content,
          metadata: {
            productId: afterData.productId,
            sourceType: afterData.sourceType,
            sourceField: afterData.sourceField,
            embeddingModel: afterData.embeddingModel,
          },
        },
      ]);

      await afterSnap.ref.set(
        {
          vectorIndexedAt: admin.firestore.FieldValue.serverTimestamp(),
          vectorIndexStatus: 'done',
        },
        { merge: true },
      );

      return { indexed: 1 };
    },
    {
      name: 'processChunkIndexing',
      run_type: 'tool',
      extractInputs: ({ chunkId }) => ({ chunkId }),
      extractOutputs: (output) => output,
      metadata: {
        chunkPath: afterSnap.ref.path,
      },
      tags: ['vector index'],
    },
  );

  try {
    await tracedIndex({ chunkId: event.params.chunkId });
  } catch (err) {
    console.error('[processChunkIndexing] error', err);
    const errorText = err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
    await afterSnap.ref.set(
      {
        vectorIndexStatus: 'error',
        vectorIndexError: errorText,
      },
      { merge: true },
    );
    throw err;
  }

  return null;
});

export default processChunkIndexing;
