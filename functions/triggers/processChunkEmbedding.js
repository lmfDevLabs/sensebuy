import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import admin from 'firebase-admin';
import { db } from '../firebase/admin.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';
import { setupLangSmith } from '../ai/langchain/tracing.js';
import { makeEmbedder } from '../ai/langchain/embeddings.js';
import { scoreChunkQuality } from '../utilities/chunkQuality.js';

setupLangSmith();

const embedder = makeEmbedder();
const embedderModel = embedder.model || embedder.modelName || 'unknown-model';

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

          const embedding = await embedder.embedQuery(data.content);
          await docRef.update({
            embedding,
            embeddingStatus: 'done',
            embeddingModel: embedderModel,
            errorMessage: null,
            qualityScore: quality.score,
            qualityCategory: quality.category,
            qualityReasons: quality.reasons,
            qualityLang: quality.lang,
          });
        } catch (err) {
          const errorText =
            err?.message ?? (typeof err === 'string' ? err : JSON.stringify(err));
          try {
            await docRef.update({
              embeddingStatus: 'error',
              errorMessage: errorText,
              retries: admin.firestore.FieldValue.increment(1),
            });
          } catch (updateErr) {
            const updateErrorText =
              updateErr?.message ??
              (typeof updateErr === 'string'
                ? updateErr
                : JSON.stringify(updateErr));
            console.error('Failed to update error status for document', {
              docPath,
              originalError: errorText,
              updateError: updateErrorText,
            });
          }
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
