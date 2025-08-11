// import { onDocumentCreated } from "firebase-functions/v2/firestore";
// import admin from 'firebase-admin';
// import { db } from '../firebase/admin.js';

// // utilities
// import { loadHtmlDocs, loadPdfDocs } from '../utilities/externalDocs.js';
// import { splitTextWithLangChain } from '../utilities/textProcessing.js';

// const CHUNKS_COLLECTION_NAME = 'chunks_embeddings';

// const extractChunksFromProductUrlsOnCreate = onDocumentCreated(
//   {
//     document: 'products/{productId}',
//   },
//   async (event) => {
//     console.log("extractChunksFromProductUrlsOnCreate");

//     const data = event.data?.data();
//     const productId = event.params.productId;

//     if (!data || !productId) {
//       console.log("Missing product data or ID.");
//       return null;
//     }

//     const urlFields = ['product_url', 'pdf'];

//     for (const urlField of urlFields) {
//       const currentUrl = data?.[urlField];

//       if (!currentUrl) {
//         console.log(`[${urlField}] No URL provided. Skipping.`);
//         continue;
//       }

//       try {
//         console.log(`[${urlField}] Processing URL on create: ${currentUrl}`);

//         const response = await fetch(currentUrl);
//         if (!response.ok) {
//           console.error(`[${urlField}] HTTP error: ${response.statusText}`);
//           continue;
//         }

//         const contentType = response.headers.get('content-type')?.toLowerCase() || '';
//         let textContent = null;
//         let sourceType = 'unknown';

//         if (contentType.includes('text/html')) {
//           const htmlContent = await response.text();
//           textContent = await loadHtmlDocs(htmlContent);
//           sourceType = 'html';
//         } else if (contentType.includes('application/pdf')) {
//           const pdfBuffer = await response.buffer();
//           textContent = await loadPdfDocs(pdfBuffer);
//           sourceType = 'pdf';
//         } else {
//           console.log(`[${urlField}] Unsupported content type: ${contentType}`);
//           continue;
//         }

//         if (!textContent || textContent.length < 100) {
//           console.log(`[${urlField}] Extracted text too short. Skipping.`);
//           continue;
//         }

//         const chunks = splitTextWithLangChain(textContent, 700, 100);
//         if (chunks.length === 0) {
//           console.log(`[${urlField}] No chunks generated. Skipping.`);
//           continue;
//         }

//         const chunksCollectionRef = db.collection(CHUNKS_COLLECTION_NAME);

//         const writeOps = chunks.map((chunkText, index) =>
//           chunksCollectionRef.add({
//             productId,
//             chunkText,
//             chunkIndex: index,
//             sourceType,
//             sourceField: urlField,
//             sourceIdentifier: `${urlField}:${currentUrl}`,
//             embedding: null,
//             createdAt: admin.firestore.FieldValue.serverTimestamp(),
//             embeddingStatus: 'pending'
//           })
//         );

//         await Promise.all(writeOps);
//         console.log(`[${urlField}] Stored ${chunks.length} chunks for product ${productId}.`);
//       } catch (err) {
//         console.error(`[${urlField}] Error during processing:`, err);
//       }
//     }

//     return null;
//   }
// );

// export default extractChunksFromProductUrlsOnCreate;


import { onDocumentCreated } from "firebase-functions/v2/firestore";
import admin from 'firebase-admin';
import { db } from '../firebase/admin.js';

// utilities
import { loadHtmlDocs, loadPdfDocs } from '../utilities/externalDocs.js';
import { splitTextWithLangChain } from '../utilities/textProcessing.js';

const CHUNKS_COLLECTION_NAME = 'chunks_embeddings';

// const extractChunksFromProductUrlsOnCreate = onDocumentCreated(
//   {
//     document: 'products/{productId}',
//   },
//   async (event) => {
//     console.log("extractChunksFromProductUrlsOnCreate");

//     const data = event.data?.data();
//     const productId = event.params.productId;

//     if (!data || !productId) {
//       console.log("Missing product data or ID.");
//       return null;
//     }

//     const urlFields = ['product_url', 'pdf'];

//     for (const urlField of urlFields) {
//       const currentUrl = data?.[urlField];

//       if (!currentUrl) {
//         console.log(`[${urlField}] No URL provided. Skipping.`);
//         continue;
//       }

//       try {
//         console.log(`[${urlField}] Processing URL on create: ${currentUrl}`);

//         const response = await fetch(currentUrl);
//         if (!response.ok) {
//           console.error(`[${urlField}] HTTP error: ${response.statusText}`);
//           continue;
//         }

//         const contentType = response.headers.get('content-type')?.toLowerCase() || '';
//         let textContent = null;
//         let sourceType = 'unknown';

//         if (contentType.includes('text/html')) {
//           const htmlContent = await response.text();
//           textContent = await loadHtmlDocs(htmlContent);
//           sourceType = 'html';
//         } else if (contentType.includes('application/pdf')) {
//           const pdfArrayBuffer = await response.arrayBuffer();
//           const pdfBuffer = Buffer.from(pdfArrayBuffer); // ✅ FIX aquí
//           textContent = await loadPdfDocs(pdfBuffer);
//           sourceType = 'pdf';
//         } else {
//           console.log(`[${urlField}] Unsupported content type: ${contentType}`);
//           continue;
//         }

//         if (!textContent || textContent.length < 100) {
//           console.log(`[${urlField}] Extracted text too short. Skipping.`);
//           continue;
//         }

//         const chunks = splitTextWithLangChain(textContent, 700, 100);
//         if (chunks.length === 0) {
//           console.log(`[${urlField}] No chunks generated. Skipping.`);
//           continue;
//         }

//         const chunksCollectionRef = db.collection(CHUNKS_COLLECTION_NAME);

//         const writeOps = chunks.map((chunkText, index) =>
//           chunksCollectionRef.add({
//             productId,
//             chunkText,
//             chunkIndex: index,
//             sourceType,
//             sourceField: urlField,
//             sourceIdentifier: `${urlField}:${currentUrl}`,
//             embedding: null,
//             createdAt: admin.firestore.FieldValue.serverTimestamp(),
//             embeddingStatus: 'pending'
//           })
//         );

//         await Promise.all(writeOps);
//         console.log(`[${urlField}] Stored ${chunks.length} chunks for product ${productId}.`);
//       } catch (err) {
//         console.error(`[${urlField}] Error during processing:`, err);
//       }
//     }

//     return null;
//   }
// );

const extractChunksFromProductUrlsOnCreate = onDocumentCreated(
  {
    document: 'products/{productId}',
  },
  async (event) => {
    console.log("📥 Trigger: extractChunksFromProductUrlsOnCreate");

    const data = event.data?.data();
    const productId = event.params.productId;

    if (!data || !productId) {
      console.log("❌ Missing product data or ID.");
      return null;
    }

    const urlFields = ['product_url', 'pdf'];

    for (const urlField of urlFields) {
      const currentUrl = data?.[urlField];

      if (!currentUrl) {
        console.log(`⚠️ [${urlField}] No URL provided. Skipping.`);
        continue;
      }

      try {
        console.log(`🌐 [${urlField}] Processing URL: ${currentUrl}`);

        const response = await fetch(currentUrl);
        if (!response.ok) {
          console.error(`❌ [${urlField}] HTTP error: ${response.statusText}`);
          continue;
        }

        const contentType = response.headers.get('content-type')?.toLowerCase() || '';
        let textContent = null;
        let sourceType = 'unknown';

        if (contentType.includes('text/html')) {
          const htmlContent = await response.text();
          textContent = await loadHtmlDocs(htmlContent);
          sourceType = 'html';
        } else if (contentType.includes('application/pdf')) {
          const pdfArrayBuffer = await response.arrayBuffer();
          const pdfBuffer = Buffer.from(pdfArrayBuffer);
          textContent = await loadPdfDocs(pdfBuffer);
          sourceType = 'pdf';
        } else {
          console.log(`⚠️ [${urlField}] Unsupported content type: ${contentType}`);
          continue;
        }

        if (!textContent || typeof textContent !== 'string' || textContent.length < 100) {
          console.log(`⚠️ [${urlField}] Extracted text too short or invalid. Length: ${textContent?.length || 0}`);
          continue;
        }

        const chunks = await splitTextWithLangChain(textContent, 700, 100);
        if (!Array.isArray(chunks) || chunks.length === 0) {
          console.log(`⚠️ [${urlField}] No chunks generated.`);
          continue;
        }

        const chunksCollectionRef = db.collection(CHUNKS_COLLECTION_NAME);

        const writeOps = chunks.map((chunkText, index) =>
          chunksCollectionRef.add({
            productId,
            chunkText,
            chunkIndex: index,
            sourceType,
            sourceField: urlField,
            sourceIdentifier: `${urlField}:${currentUrl}`,
            embedding: null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            embeddingStatus: 'pending'
          })
        );

        await Promise.all(writeOps);
        console.log(`✅ [${urlField}] Stored ${chunks.length} chunks for product ${productId}.`);
      } catch (err) {
        console.error(`❌ [${urlField}] Error during processing:`, err);
      }
    }

    return null;
  }
);

export default extractChunksFromProductUrlsOnCreate;
