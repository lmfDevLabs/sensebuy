import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from '../firebase/admin.js'

// V2
const updateShowRoomOnProductCreate = onDocumentCreated( // Añadí 'export' si planeas exportar esta función
  'products/{productId}',
  async (snap, context) => {
    console.log('updateShowRoomOnProductCreate');
    // Obtener los datos del producto recién creado
    const newProduct = snap.data();

    // Verificar si el campo 'tags' existe y es un array
    if (newProduct.tags && Array.isArray(newProduct.tags)) {
      try {
        // ID del showroom a actualizar
        const showRoomId = newProduct.showRoomData.showRoomId;

        // Referencia al documento del showroom - AHORA USAMOS 'db' directamente
        const showRoomRef = db.doc(`showRooms/${showRoomId}`);

        // Obtener el documento actual del showroom
        const showRoomSnap = await showRoomRef.get();

        if (showRoomSnap.exists) {
          const showRoomData = showRoomSnap.data();
          let currentTags = showRoomData.tags || [];

          // Convertir todos los tags a strings y filtrar tipos no deseados
          const newTags = newProduct.tags
              .map(tag => typeof tag === 'string' ? tag : tag.toString())
              .filter(tag => typeof tag === 'string' && !currentTags.includes(tag));

          if (newTags.length > 0) {
              currentTags = [...currentTags, ...newTags];
              await showRoomRef.update({ tags: currentTags });
              console.log(`Tags actualizados para el showroom: ${showRoomId}`);
          } else {
              console.log(`No hay tags nuevos para añadir al showroom: ${showRoomId}`);
          }
        } else {
          console.log('Showroom no encontrado:', showRoomId);
        }
      } catch (error) {
        console.error('Error al actualizar el showroom:', error);
      }
    } else {
        console.log('El nuevo producto no tiene un campo "tags" válido para procesar.');
    }
});

export default updateShowRoomOnProductCreate