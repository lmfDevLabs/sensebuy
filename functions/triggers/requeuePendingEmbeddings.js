import { onSchedule } from 'firebase-functions/v2/scheduler';
import { PubSub } from '@google-cloud/pubsub';
import { db } from '../firebase/admin.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const pubsub = new PubSub();
const TOPIC = 'chunk-embeddings';

const requeuePendingEmbeddings = onSchedule(
  { schedule: 'every 5 minutes', region: 'us-central1' },
  async () => {
    const tracedRequeue = traceable(
      async () => {
        const snap = await db
          .collection('chunksEmbeddings')
          .where('embeddingStatus', 'in', ['pending', 'error'])
          .limit(200)
          .get();

        const promises = snap.docs.map((doc) =>
          pubsub.topic(TOPIC).publishMessage({
            json: { docPath: doc.ref.path, hash: doc.get('embeddingHash') }
          })
        );

        await Promise.all(promises);
        return { requeued: promises.length };
      },
      {
        name: 'requeuePendingEmbeddings',
        run_type: 'tool',
        extractInputs: () => ({}),
        extractOutputs: (output) => output,
        tags: ['requeue embedding'],
      }
    );

    await tracedRequeue();
  }
);

export default requeuePendingEmbeddings;
