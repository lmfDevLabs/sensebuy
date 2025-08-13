// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

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

    const tracedQueueHtmlDocument = traceable(
      (payload) => docRef.set(payload),
      {
        name: 'queueHtmlDocument',
        run_type: 'tool',
        extractInputs: (payload) => payload,
        extractOutputs: (output) => output,
        metadata: { productId },
        tags: ['queue html'],
      }
    );

    await tracedQueueHtmlDocument({
      productId,
      product_url: data.product_url,
      source_type: 'html',
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📥 Documento HTML encolado: ${productId}`);
  }
);

export default queueHtmlDocument;
