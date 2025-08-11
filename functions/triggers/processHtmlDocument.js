// firebase
import { db } from '../firebase/admin.js'; 
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// utilities
import { extractMeaningfulTextFromHtml } from '../utilities/externalDocs.js'
import { splitTextWithLangChain } from '../utilities/textProcessing.js'

const processHtmlDocument = onDocumentCreated(
  {
    document: "html_docs_to_process/{docId}",
    region: "us-central1",
    timeoutSeconds: 60,
  },
  async (event) => {
    const docData = event.data?.data();
    const { productId, product_url } = docData;

    try {
      const { fullText, blocks } = await extractMeaningfulTextFromHtml(product_url);

      if (!fullText || blocks.length === 0) {
        console.warn(`[SKIP] Sin texto útil en ${product_url}`);
        return;
      }

      const chunks = await splitTextWithLangChain(fullText, 700, 100); // <- aquí tu método

      if (chunks.length === 0) {
        console.warn(`[SKIP] No se generaron chunks para ${productId}`);
        return;
      }

      const batch = db.batch();
      const chunksCollection = db.collection("chunks_embeddings");

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
    } catch (err) {
      console.error(`❌ Error procesando HTML de ${productId}:`, err.message);
    }
  }
);

export default processHtmlDocument
