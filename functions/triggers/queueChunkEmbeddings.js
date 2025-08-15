import { onDocumentCreated, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { PubSub } from '@google-cloud/pubsub';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const pubsub = new PubSub();
const TOPIC = 'chunk-embeddings';

const publish = (payload) =>
  pubsub.topic(TOPIC).publishMessage({ json: payload });

export const queueChunkEmbeddingOnCreate = onDocumentCreated(
  'chunksEmbeddings/{chunkId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const docPath = event.data.ref.path;
    const hash = data.embeddingHash;

    const tracedPublish = traceable(publish, {
      name: 'queueChunkEmbedding',
      run_type: 'tool',
      extractInputs: (payload) => payload,
      extractOutputs: () => ({}),
      metadata: { docPath },
      tags: ['queue embedding'],
    });

    await tracedPublish({ docPath, hash });
  }
);

export const queueChunkEmbeddingOnUpdate = onDocumentUpdated(
  'chunksEmbeddings/{chunkId}',
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;
    if (!before || !after) return;
    const beforeField = before.get('sourceField');
    const afterField = after.get('sourceField');
    if (beforeField === afterField) return;

    const docPath = after.ref.path;
    const hash = after.get('embeddingHash');

    const tracedPublish = traceable(publish, {
      name: 'queueChunkEmbedding',
      run_type: 'tool',
      extractInputs: (payload) => payload,
      extractOutputs: () => ({}),
      metadata: { docPath },
      tags: ['queue embedding'],
    });

    await tracedPublish({ docPath, hash });
  }
);
