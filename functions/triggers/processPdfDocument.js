// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// utilities
import { extractMeaningfulTextFromPdf } from '../utilities/externalDocs.js';
import { splitTextWithLangChain } from '../utilities/textProcessing.js';

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
      const { fullText, blocks } = await extractMeaningfulTextFromPdf(pdf_url);

      if (!fullText || blocks.length === 0) {
        console.warn(`[SKIP] Sin texto útil en ${pdf_url}`);
        return;
      }

      const chunks = await splitTextWithLangChain(fullText, 700, 100);

      if (chunks.length === 0) {
        console.warn(`[SKIP] No se generaron chunks para ${productId}`);
        return;
      }

      const batch = db.batch();
      const chunksCollection = db.collection("chunksEmbeddings");

      chunks.forEach((chunkText, index) => {
        const chunkRef = chunksCollection.doc();
        batch.set(chunkRef, {
          productId,
          pdf_url,
          content: chunkText,
          index,
          embeddingStatus: 'pending',
          sourceField: 'pdf_url',
          sourceIdentifier: `product/${productId}/pdf_url`,
          sourceType: 'pdf',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
      console.log(`✅ Guardados ${chunks.length} chunks para ${productId}`);
    } catch (err) {
      console.error(`❌ Error procesando PDF de ${productId}:`, err.message);
    }
  }
);

export default processPdfDocument;
