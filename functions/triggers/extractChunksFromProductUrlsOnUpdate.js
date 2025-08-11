// Asegúrate de importar desde 'firebase-functions/v2/firestore' para v2 triggers
const { onDocumentUpdated, onDocumentCreated, Change, FirestoreEvent } = require ('firebase-functions/v2/firestore');

// firebase 
const { 
  db,  
} = require('../firebase/admin.js');

// Escucha actualizaciones en documentos de la colección 'products' 
const extractChunksFromProductUrlsOnUpdate = onDocumentUpdated(
  {
    document: 'products/{productId}', // Escucha cambios en productos específicos
  },
  async (event) => {
    console.log("extractChunksFromProductUrls") // Log para debug inicial

    const productId = event.params.productId; // Obtiene el ID del producto actualizado

    // Se obtienen los snapshots "antes" y "después" de la actualización
    const snapshotBefore = event.data?.before;
    const snapshotAfter = event.data?.after;

    // Si alguno de los snapshots no está disponible, se aborta
    if (!snapshotBefore || !snapshotAfter) {
      console.log(`Missing snapshots for product ${productId}.`);
      return null;
    }

    // Datos anteriores y nuevos del producto
    const previousData = snapshotBefore.data();
    const newData = snapshotAfter.data();

    // Campos que contienen URLs de contenido externo que se analizarán
    const urlFields = ['product_url', 'pdf_url'];

    // Se procesa cada campo de URL relevante (HTML o PDF)
    for (const urlField of urlFields) {
      const previousUrl = previousData?.[urlField]; // URL antes de la actualización
      const currentUrl = newData?.[urlField];       // URL después de la actualización

      // Si la URL no ha cambiado o ha sido eliminada, se considera limpieza
      if (!currentUrl || currentUrl === previousUrl) {
        console.log(`[${urlField}] No update or removed. Checking for cleanup.`);

        // Si había una URL anterior y ahora fue eliminada, se limpian los chunks asociados
        if (previousUrl && !currentUrl) {
          const oldChunks = await db
            .collection(CHUNKS_COLLECTION_NAME)
            .where('productId', '==', productId)
            .where('sourceIdentifier', '==', `${urlField}:${previousUrl}`)
            .get();

          // Si existen chunks, se eliminan en batch
          if (!oldChunks.empty) {
            const batch = admin.firestore().batch();
            oldChunks.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`[${urlField}] Deleted ${oldChunks.size} chunks for removed URL.`);
          }
        }

        continue; // Salta al siguiente campo si no hay nueva URL que procesar
      }

      // Si hay una nueva URL o cambió, se inicia su procesamiento
      console.log(`[${urlField}] Processing new or changed URL: ${currentUrl}`);

      try {
        // Se hace fetch del contenido de la URL
        const response = await fetch(currentUrl);
        if (!response.ok) {
          console.error(`[${urlField}] HTTP error: ${response.statusText}`);
          continue;
        }

        // Detecta el tipo de contenido por header
        const contentType = response.headers.get('content-type')?.toLowerCase() || '';
        let textContent = null;   // Variable para el texto plano extraído
        let sourceType = 'unknown'; // html | pdf | otro

        // Si es HTML, se procesa con el loader correspondiente
        if (contentType.includes('text/html')) {
          const htmlContent = await response.text();
          textContent = await loadHtmlDocs(htmlContent); // Función que usa LangChain
          sourceType = 'html';
        }
        // Si es PDF, se procesa usando loader PDF
        else if (contentType.includes('application/pdf')) {
          const pdfBuffer = await response.buffer();
          textContent = await loadPdfDocs(pdfBuffer); // También con LangChain
          sourceType = 'pdf';
        } else {
          console.log(`[${urlField}] Unsupported content type: ${contentType}`);
          continue; // Salta si el tipo MIME no es soportado
        }

        // Si el texto extraído es muy corto, se omite
        if (!textContent || textContent.length < 100) {
          console.log(`[${urlField}] Extracted text is too short. Skipping.`);
          continue;
        }

        // Se generan chunks del texto usando función local (puedes cambiar por TextSplitter)
        const chunks = splitTextWithLangChain(textContent, chunkSize = 700, chunkOverlap = 100)
        if (chunks.length === 0) {
          console.log(`[${urlField}] No chunks generated. Skipping.`);
          continue;
        }

        // Se prepara la colección donde se guardarán los chunks
        const chunksCollectionRef = db.collection(CHUNKS_COLLECTION_NAME);

        // Por cada chunk, se crea un documento con metadata útil
        const writeOps = chunks.map((chunkText, index) => {
          return chunksCollectionRef.add({
            productId,              // ID del producto relacionado
            chunkText,             // Texto del chunk
            chunkIndex: index,     // Índice del chunk
            sourceType,            // Tipo de fuente (html/pdf)
            sourceField: urlField, // Campo del producto que lo originó
            sourceIdentifier: `${urlField}:${currentUrl}`, // Identificador único por URL
            embedding: null,       // Aquí se deja nulo para luego calcular embeddings
            createdAt: admin.firestore.FieldValue.serverTimestamp(), // Timestamp
            embeddingStatus: 'pending'
          });
        });

        // Se ejecutan todos los writes en paralelo
        await Promise.all(writeOps);
        console.log(`[${urlField}] Stored ${chunks.length} chunks for product ${productId}.`);
      } catch (err) {
        console.error(`[${urlField}] Error during processing:`, err);
      }
    }
  }
);

export default extractChunksFromProductUrlsOnUpdate