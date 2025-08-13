// firebase
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { onDocumentCreated } from "firebase-functions/v2/firestore";
// 🧠 Langsmith
import { traceable } from 'langsmith/traceable';

const queuePdfDocument = onDocumentCreated(
  {
    document: 'products/{productId}',
    region: 'us-central1',
  },
  async (event) => {
    console.log("queuePdfDocument")
    const data = event.data?.data();
    const productId = event.params.productId;

    if (!data?.pdf) return;

    const docRef = db.collection('pdfDocsToProcess').doc(productId);

    const tracedQueuePdfDocument = traceable(
      (payload) => docRef.set(payload),
      {
        name: 'queuePdfDocument',
        run_type: 'tool',
        extractInputs: (payload) => payload,
        extractOutputs: (output) => output,
        metadata: { productId },
        tags: ['queue pdf'],
      }
    );

    await tracedQueuePdfDocument({
      productId,
      pdf_url: data.pdf,
      source_type: 'pdf',
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`📥 Documento PDF encolado: ${productId}`);
  }
);

export default queuePdfDocument;
