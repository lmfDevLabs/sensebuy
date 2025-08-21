import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import admin from 'firebase-admin';
import { db } from '../firebase/admin.js';
import embedChunkFlow from '../genkit/flows/embedChunkFlow.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const processChunkEmbedding = onMessagePublished(
  { topic: 'chunk-embeddings', region: 'us-central1' },
  async (event) => {
    console.log("processChunkEmbedding")
    const { docPath, hash } = event.data.message.json;
    if (!docPath || !hash) return;

    const tracedProcessChucksEmbbedings = traceable(
      async ({ docPath, hash }) => {
        const docRef = db.doc(docPath);
        const snapshot = await docRef.get();
        if (!snapshot.exists) return;
        const data = snapshot.data();
        if (data.embeddingHash !== hash) return;

        // Mark as processing with a lease
        await docRef.update({
          embeddingStatus: 'processing',
          processingAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        try {
          const { embedding, model } = await embedChunkFlow(data.content);
          await docRef.update({
            embedding,
            embeddingStatus: 'done',
            embeddingModel: model,
            errorMessage: null,
          });
        } catch (err) {
          await docRef.update({
            embeddingStatus: 'error',
            errorMessage: err.message,
            retries: admin.firestore.FieldValue.increment(1),
          });
        }
      },
      {
        name: 'processChunkEmbedding',
        run_type: 'tool',
        extractInputs: (payload) => payload,
        extractOutputs: () => ({}),
        metadata: { docPath },
        tags: ['process chunk embedding'],
      }
    );

    await tracedProcessChucksEmbbedings({ docPath, hash });
  }
);

export default processChunkEmbedding;
