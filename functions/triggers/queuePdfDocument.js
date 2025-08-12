// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const queuePdfDocument = onDocumentCreated(
  {
    document: 'products/{productId}',
    region: 'us-central1',
  },
  async (event) => {
    console.log("queuePdfDocument")
    const data = event.data?.data();
    const productId = event.params.productId;

    if (!data?.pdf_url) return; // ojo aca

    const docRef = db.collection('pdfDocsToProcess').doc(productId);

    await docRef.set({
      productId,
      product_url: data.product_url,
      source_type: 'pdf',
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📥 Documento PDF encolado: ${productId}`);
  }
);

export default queuePdfDocument
