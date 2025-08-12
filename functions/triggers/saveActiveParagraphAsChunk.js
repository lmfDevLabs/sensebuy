import { db } from '../firebase/admin.js'
import admin from 'firebase-admin';
// Asegúrate de importar desde 'firebase-functions/v2/firestore' para v2 triggers
import { onDocumentCreated } from "firebase-functions/v2/firestore";


// global
const CHUNKS_COLLECTION_NAME = 'chunksEmbeddings';

// salva el "active paragraph" como chunk 
const saveActiveParagraphAsChunk = onDocumentCreated(
  'products/{productId}', 
  async (event) => {
    console.log("saveActiveParagraphAsChunk")
    const data = event.data?.data();
    const productId = event.params.productId;
    const activeParagraph = data?.activeParagraph;

    if (!activeParagraph || activeParagraph.trim().length < 50) {
      console.log(`No valid activeParagraph found for product ${productId}. Skipping chunk creation.`);
      return null;
    } 

    const chunksCollectionRef = db.collection(CHUNKS_COLLECTION_NAME)

    await chunksCollectionRef.add({
      productId,
      chunkText: activeParagraph,
      chunkIndex: 0, // Solo un chunk
      sourceType: 'inventory',
      sourceField: 'activeParagraph',
      sourceIdentifier: `product/${productId}/activeParagraph`,
      embedding: null, // será llenado en el segundo trigger
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      embeddingStatus: 'pending'
    });

    console.log(`Stored activeParagraph of product ${productId} as a chunk.`);

    return null;
  }
);

export default saveActiveParagraphAsChunk