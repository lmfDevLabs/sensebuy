// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const queueHtmlDocument = onDocumentCreated(
  {
    document: 'products/{productId}',
    region: 'us-central1',
  },
  async (event) => {
    console.log("queueHtmlDocument")
    const data = event.data?.data();
    const productId = event.params.productId;

    if (!data?.product_url) return;

    const docRef = db.collection('htmlDocsToProcess').doc(productId);

    await docRef.set({
      productId,
      product_url: data.product_url,
      source_type: 'html',
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📥 Documento HTML encolado: ${productId}`);
  }
);

export default queueHtmlDocument
