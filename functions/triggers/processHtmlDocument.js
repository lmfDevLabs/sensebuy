// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// utilities
import { extractMeaningfulTextFromHtml } from '../utilities/externalDocs.js';
import { splitTextWithLangChain } from '../utilities/textProcessing.js';
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const processHtmlDocument = onDocumentCreated(
  {
    document: "htmlDocsToProcess/{docId}",
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (event) => {
    
    console.log("processHtmlDocument")
    const docData = event.data?.data();
    const { productId, product_url } = docData;

    try {
      const tracedExtractMeaningfulTextFromHtml = traceable(
        extractMeaningfulTextFromHtml,
        {
          name: 'extractMeaningfulTextFromHtml',
          run_type: 'tool',
          extractInputs: (product_url) => ({ product_url }),
          extractOutputs: (output) => output,
          metadata: { productId },
          tags: ['extract html'],
        }
      );

      const { fullText, blocks } = await tracedExtractMeaningfulTextFromHtml(product_url);

      if (!fullText || blocks.length === 0) {
        console.warn(`[SKIP] Sin texto útil en ${product_url}`);
        return;
      }

      const tracedSplitTextWithLangChain = traceable(
        splitTextWithLangChain,
        {
          name: 'splitTextWithLangChain',
          run_type: 'tool',
          extractInputs: (fullText, chunkSize, overlap) => ({ chunkSize, overlap }),
          extractOutputs: (chunks) => ({ chunksCount: chunks.length }),
          metadata: { productId },
          tags: ['chunk html'],
        }
      );

      const chunks = await tracedSplitTextWithLangChain(fullText, 700, 100);

      if (chunks.length === 0) {
        console.warn(`[SKIP] No se generaron chunks para ${productId}`);
        return;
      }

      const saveChunks = async (chunks) => {
        const batch = db.batch();
        const chunksCollection = db.collection("chunksEmbeddings");

        chunks.forEach((chunkText, index) => {
          const chunkRef = chunksCollection.doc();
          batch.set(chunkRef, {
            productId,
            product_url,
            content: chunkText,
            index,
            embeddingStatus: 'pending',
            sourceField: 'product_url',
            sourceIdentifier: `product/${productId}/product_url`,
            sourceType: 'html',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
        console.log(`✅ Guardados ${chunks.length} chunks para ${productId}`);
      };

      const tracedSaveChunks = traceable(
        saveChunks,
        {
          name: 'saveHtmlChunks',
          run_type: 'tool',
          extractInputs: (chunks) => ({ chunksCount: chunks.length }),
          extractOutputs: (output) => output,
          metadata: { productId },
          tags: ['save html chunks'],
        }
      );

      await tracedSaveChunks(chunks);
    } catch (err) {
      console.error(`❌ Error procesando HTML de ${productId}:`, err.message);
    }
  }
);

export default processHtmlDocument;
