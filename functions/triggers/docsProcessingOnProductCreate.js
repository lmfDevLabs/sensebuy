import { onDocumentCreated } from "firebase-functions/v2/firestore";

// Fetch (Node 18+)
const fetch = globalThis.fetch;

// V2
const docsProcessingOnProductCreate = onDocumentCreated( // Añadí 'export'
  'products/{productId}',
  async (snap, context) => {
    console.log('docsProcessingOnProductCreate');
    const newProduct = snap.data();
    const productId = context.params.productId;
    // Preparar los datos que se enviarán al servidor Flask
    const postData = {
      ...newProduct,
      productId
    };

    // Usar fetch para enviar la solicitud POST al servidor Flask
    try {
      const response = await fetch('https://5572-200-3-154-147.ngrok-free.app/process-product-docs', { // ¡Cuidado con usar ngrok en producción! Es una URL temporal.
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData),
      });

      // Manejar la respuesta del servidor Flask
      if (!response.ok) { // Verifica si la respuesta HTTP fue exitosa (código 2xx)
          const errorText = await response.text();
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const responseData = await response.json();
      console.log("Response from Flask server:", responseData);
    } catch (error) {
      console.error("Error al enviar los datos a Flask:", error);
    }
});

export default docsProcessingOnProductCreate