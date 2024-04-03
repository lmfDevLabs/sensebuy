// firebase 
const { 
    db, 
} = require('../firebase/admin');

// add data to fb
exports.addDataToFirestore = async (optionsDB) => {
    // Array
    const commitBatches = [];
    try {
        // print
        console.log('addDataToFirestore');
        const MAX_BATCH_SIZE = 500; // Firestore batch write limit
        let batch = db.batch();
        // Loop over data
        optionsDB.data.forEach((doc, index) => {
            const docRef = db.collection(optionsDB.collection).doc(); // Crea un nuevo documento para cada producto
            switch(optionsDB.collection){
                case 'products':
                let dataObject = {
                    selleData:{
                        sellerId:optionsDB.extras.sellerId,
                        companyName:optionsDB.extras.companyName,
                    },
                    coords:optionsDB.extras.coords,
                    createdAt:new Date().toISOString(),
                    ...doc
                }
                // pass data to the doc
                batch.set(docRef, dataObject);
                break;
            }   
            // Si alcanzamos el límite del batch o es el último elemento, preparamos para enviar
            if ((index + 1) % MAX_BATCH_SIZE === 0 || index === optionsDB.data.length - 1) {
                commitBatches.push(batch.commit()); // Añade la promesa del commit a la lista
                batch = db.batch(); // Reinicia el batch para el siguiente grupo de documentos
            }
        });
    } catch (error) {
        console.error('Error addDataToFirestore:', error);
    }
    // Espera a que todos los batches se hayan enviado
    await Promise.all(commitBatches);
}
// save embeddings in firestore
exports.saveEmbeddingsOnFirestore = async (embeddings,showRoomId) => {
    // Aquí deberías guardar los embeddings en Vertex AI
    console.log('saveEmbeddingsOnFirestore:');
    // Aquí deberías guardar los embeddings en Firestore
    const commitBatches = [];
    const batch = db.batch();
    try{
        const embeddingsCollectionRef = db
            .collection('showRooms')
            .doc(showRoomId)
            .collection('embeddings');

        embeddings.forEach((embedding) => {
            const docRef = embeddingsCollectionRef.doc(); // Create a new document for each embedding
            batch.set(docRef, embedding);
        });
    }catch(err){
        console.error('Error saveEmbeddingsOnFirestore:', err);
    }
    commitBatches.push(batch.commit());
};