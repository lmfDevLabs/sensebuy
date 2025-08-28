// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// utilities
import { extractMeaningfulTextFromPdf } from '../utilities/externalDocs.js';
import { splitTextWithLangChain } from '../utilities/textProcessing.js';
import { computeHash } from '../utilities/hash.js';
import { filterChunksByQuality } from '../utilities/chunkQuality.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const processPdfDocument = onDocumentCreated(
  {
    document: "pdfDocsToProcess/{docId}",
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (event) => {

    console.log("processPdfDocument")
    const docData = event.data?.data();
    const { productId, pdf_url } = docData;

    try {
      const tracedExtractMeaningfulTextFromPdf = traceable(
        extractMeaningfulTextFromPdf,
        {
          name: 'extractMeaningfulTextFromPdf',
          run_type: 'tool',
          extractInputs: (pdf_url) => ({ pdf_url }),
          extractOutputs: (output) => output,
          metadata: { productId },
          tags: ['extract pdf'],
        }
      );

      const { fullText, blocks } = await tracedExtractMeaningfulTextFromPdf(pdf_url);

      if (!fullText || blocks.length === 0) {
        console.warn(`[SKIP] Sin texto útil en ${pdf_url}`);
        return;
      }

      const tracedSplitTextWithLangChain = traceable(
        splitTextWithLangChain,
        {
          name: 'splitTextWithLangChain',
          run_type: 'tool',
          extractInputs: (fullText) => ({ chars: fullText.length }),
          extractOutputs: (chunks) => ({ chunksCount: chunks.length }),
          metadata: { productId },
          tags: ['chunk pdf'],
        }
      );

      const chunks = await tracedSplitTextWithLangChain(fullText);

      if (chunks.length === 0) {
        console.warn(`[SKIP] No se generaron chunks para ${productId}`);
        return;
      }

      const { kept, dropped } = filterChunksByQuality(chunks, { preferLang: 'es' });

      if (kept.length === 0) {
        console.warn(`[SKIP] Todos los chunks fueron filtrados para ${productId}`);
        return;
      }

      const saveChunks = async (qualityChunks) => {
        const batch = db.batch();
        const chunksCollection = db.collection('chunksEmbeddings');

        qualityChunks.forEach(({ text, score, category, reasons, lang }, index) => {
          const chunkRef = chunksCollection.doc();
          batch.set(chunkRef, {
            productId,
            pdf_url,
            content: text,
            index,
            embeddingStatus: 'pending',
            embeddingHash: computeHash(text),
            embeddingModel: null,
            errorMessage: null,
            retries: 0,
            sourceField: 'pdf',
            sourceIdentifier: `product/${productId}/pdf_url`,
            sourceType: 'pdf',
            qualityScore: score,
            qualityCategory: category,
            qualityReasons: reasons,
            qualityLang: lang,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
        console.log(`✅ Guardados ${qualityChunks.length} chunks para ${productId} (dropped ${dropped.length})`);
      };

      const tracedSaveChunks = traceable(
        saveChunks,
        {
          name: 'savePdfChunks',
          run_type: 'tool',
          extractInputs: (chunks) => ({ chunksCount: chunks.length }),
          extractOutputs: (output) => output,
          metadata: { productId },
          tags: ['save pdf chunks'],
        }
      );

      await tracedSaveChunks(kept);
    } catch (err) {
      console.error(`❌ Error procesando PDF de ${productId}:`, err.message);
    }
  }
);

export default processPdfDocument;
