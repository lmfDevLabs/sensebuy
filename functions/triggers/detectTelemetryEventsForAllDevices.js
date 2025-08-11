import { onMessagePublished } from "firebase-functions/v2/pubsub";
import { serverTimestamp } from "firebase/firestore";
import { db } from '../firebase/admin.js'
// Fetch (Node 18+)
const fetch = globalThis.fetch;

const detectTelemetryEventsForAllDevices = onMessagePublished(
  'telemetry', 
  async(message)=>{ // Añadí 'export'
    const payload = message.json;
    const buyerId = payload.buyerId;
    console.log({buyerId})
    try {
      // Referencia a la colección 'buyers' - AHORA USAMOS 'db' directamente
      const buyerDocRef = db.collection('buyers').doc(buyerId);
      await buyerDocRef.update({
        dataMobilDevice: {
          // serverTimestamp importado directamente
          lastMessageReceived: serverTimestamp(),
          ...payload.dataMobilDevice
        },
        statusOfBracelet: payload.statusOfBracelet
      });
      console.log('Message saved to Firestore for buyer:', buyerId);
    } catch (error) {
      console.error('Error saving message to Firestore:', error);
    }
  }
)

export default detectTelemetryEventsForAllDevices