import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import admin from 'firebase-admin';
import { db } from '../firebase/admin.js';
import embedChunkFlow from '../genkit/flows/embedChunkFlow.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';
import { scoreChunkQuality } from '../utilities/chunkQuality.js';

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
          const quality = data.qualityScore !== undefined ? {
            score: data.qualityScore,
            category: data.qualityCategory,
            reasons: data.qualityReasons || [],
            lang: data.qualityLang,
          } : scoreChunkQuality(data.content, { preferLang: 'es' });

          const accept =
            quality.score >= 0.55 ||
            (quality.category === 'SPEC_TABLE' && quality.score >= 0.40);

          if (!accept) {
            await docRef.update({
              embeddingStatus: 'skipped',
              qualityScore: quality.score,
              qualityCategory: quality.category,
              qualityReasons: quality.reasons,
              qualityLang: quality.lang,
            });
            return;
          }

          const { embedding, model } = await embedChunkFlow(data.content);
          await docRef.update({
            embedding,
            embeddingStatus: 'done',
            embeddingModel: model,
            errorMessage: null,
            qualityScore: quality.score,
            qualityCategory: quality.category,
            qualityReasons: quality.reasons,
            qualityLang: quality.lang,
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
