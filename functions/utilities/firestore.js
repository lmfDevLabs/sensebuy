// firebase 
const { 
    db,  
} = require('../firebase/admin');

// utilities
const { 
    preprocessText,  
} = require('./nlp');

const { 
    getEmbeddingsFromOpenAI,  
} = require('./embeddings');

const { 
    outputTags,  
    removeLastPathSegment
} = require('./common');


///////// USERS - SELLERS
// add data to fb
const addDataToFirestore = async (optionsDB) => {
    // Array
    const commitBatches = [];
    const documentIds = [];
    try {
        // print
        console.log('addDataToFirestore');
        const MAX_BATCH_SIZE = 500; // Firestore batch write limit
        let batch = db.batch();
        // Loop over data
        await optionsDB.data.forEach(async(doc, index) => {
             // Crea un nuevo documento para cada producto
            const docRef = db.collection(optionsDB.collection).doc();
            // Guarda el ID del documento creado
            documentIds.push(docRef.id); 
            // mapper
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
    // Devuelve los IDs de los documentos creados
    return documentIds;
}

// save embeddings in firestore
const saveEmbeddingsOnFirestore = async (embeddings, showRoomId) => {
    console.log('saveEmbeddingsOnFirestore:');
    const commitBatches = [];
    const batch = db.batch();
    try {
        const embeddingsCollectionRef = db
            .collection('showRooms')
            .doc(showRoomId)
            .collection('embeddings');

        embeddings.forEach((embedding) => {
            const docRef = embeddingsCollectionRef.doc(); // Create a new document for each embedding
            const { companyName, sellerId, productId, ...vector } = embedding; // Destructure to separate vector
            batch.set(docRef, {
                vector:vector.embedding.data[0],
                companyName, 
                sellerId,
                productId,
            });
        });
    } catch (err) {
        console.error('Error saveEmbeddingsOnFirestore:', err);
    }
    commitBatches.push(batch.commit());
};

// to save url path to file embeddings and docs from sellers products
const saveUrlFromEmbeddingsAndDocsOfProductsFromSellers = async (jsonFilePath,sellerId) => {
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


///////// USERS - BUYERS
// Función para guardar el mensaje y su embedding en Firestore
const saveMessageWithEmbedding = async (userId, sessionId, role, content, intention = null) => {
    const timestamp = new Date().toISOString();
    const preprocessedContent = preprocessText(content);
    const embedding = await getEmbeddingsFromOpenAI(preprocessedContent);

    try {
        const messageData = {
            role: role,
            content: content,
            preprocessedContent: preprocessedContent,
            timestamp: timestamp,
            embedding: embedding,
        };

        if (role === "assistant" && intention) {
            messageData.intention = intention;
        }

        await db.collection('chats').doc(userId).collection('sessions').doc(sessionId).collection('messages').add(messageData);
        console.log('Mensaje guardado en Firebase con embedding');
    } catch (error) {
        console.error('Error al guardar el mensaje con embedding:', error);
        throw error;
    }
};

// to save chat messages
const createChatMessage = async (data) => {
        console.log('createChatMessage')
        // extract 
        const {
            userId, 
            sessionId, 
            role, 
            content
            // userQuery,
            // // data from res
            // intention, 
            // response, 
            // fullRes
        } = data
        // time
        const timestamp = new Date().toISOString();
        try {
            const dbRef = await db
                .collection('chats')
                .doc(userId)
                .collection('sessions')
                .doc(sessionId)
                .collection('messages')
            // ask for role
            if(role === "assistant"){
                dbRef.add({
                    role,
                    timestamp,
                    content
                    //
                    // intention,
                    // response,
                    // fullRes
                });
                console.log('Mensaje guardado en Firebase para assistant');
            } else if (role === "user"){
                dbRef.add({
                    role,
                    // userQuery,
                    timestamp,
                    content
                });
                console.log('Mensaje guardado en Firebase para user');
            }
        } catch (error) {
            console.error('Error al guardar el mensaje:', error);
            throw error;
        }
}

// to get chat messages
const getChatMessages = async (userId, sessionId) => {
    try {
        const messages = await db.collection('chats').doc(userId).collection('sessions').doc(sessionId).collection('messages').orderBy('timestamp').get();
        return messages.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
        throw error;
    }
}

// module exports
module.exports = {
    addDataToFirestore,
    saveEmbeddingsOnFirestore,
    saveUrlFromEmbeddingsAndDocsOfProductsFromSellers,
    createChatMessage,
    saveMessageWithEmbedding,
    getChatMessages,
};

