// firebase 
const { 
    db,  
} = require('../firebase/admin');

// Método para extraer valores de un objeto y asegurar que son strings
const outputTags = async (obj) => {
    console.log('outputTaxonomy');
    let arrValues = [];

    // Define las llaves que quieres excluir
    const excludeKeys = ['description', 'pics', 'pdf']; // Llaves a excluir

    // Recorre cada par llave-valor en el objeto
    await Object.entries(obj).forEach(([key, value]) => {
        // Excluye las llaves especificadas
        if (!excludeKeys.includes(key)) {
            // Si el valor es una cadena con comas, lo dividimos y agregamos cada parte al arreglo de valores
            if (typeof value === 'string' && value.includes(',')) {
                const valuesArray = value.split(',').map(item => item.trim());
                arrValues.push(...valuesArray);
            } else {
                arrValues.push(String(value)); // Aseguramos que todos los valores sean strings
            }
        }
    });

    return arrValues;
};

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
        await optionsDB.data.forEach(async(doc, index) => {
            const docRef = db.collection(optionsDB.collection).doc(); // Crea un nuevo documento para cada producto
            switch(optionsDB.collection){
                case 'products':
                let dataObject = {
                    showRoomData:{
                        showRoomId:optionsDB.extras.showRoomId,
                    },
                    sellerData:{
                        sellerId:optionsDB.extras.sellerId,
                        companyName:optionsDB.extras.companyName,
                    },
                    // metadata
                    tags:await outputTags(doc), 
                    // cords
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

// to crop last part of the url sellers docs path
const removeLastPathSegment = (url) => {
    // Encuentra la posición del último '/'
    const lastSlashIndex = url.lastIndexOf('/');
    // Si no hay '/', retorna la URL original
    if (lastSlashIndex === -1) {
        return url;
    }
    // Retorna la URL sin la última parte del path
    return url.substring(0, lastSlashIndex);
}

// to save url path to file embeddings and docs from sellers products
exports.saveUrlFromEmbeddingsAndDocsOfProductsFromSellers = async (jsonFilePath,sellerId) => {
    // Obtener la URL del archivo JSON subido
    const fileUrl = `${process.env.URL_OF_CLOUD_STORAGE_BUCKET}${jsonFilePath}`;
    const cropUrl = removeLastPathSegment(fileUrl)
    // Guardar la URL del archivo JSON en el documento del vendedor en Firestore
    const sellerRef = db.collection('sellers').doc(sellerId);
    await sellerRef.update({
        embeddingsAndDocsUrl: cropUrl
    });
    console.log('URL del archivo JSON guardada en el documento del vendedor en Firestore.');
    
} 

