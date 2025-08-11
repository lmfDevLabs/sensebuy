// utilities
import { classifyChatSearchIntention } from './openAi.js';  
import { searchInAlgolia } from './algolia.js';
// import { searchInTempVectorDB } from './embeddings.js';

// enrutador de medios de búsqueda
// const handleUserQuery = async (sessionId, messages) => {
//     console.log("handleUserQuery")
//     const interactionLimit = 4;
//     const interactionCount = messages.length;

//     let intention = messages.find(msg => msg.intention) ? messages.find(msg => msg.intention).intention : null;
//     let fullRes = ""

//     if (!intention || interactionCount >= interactionLimit) {
//         const { fullResponse, intention: newIntention } = await classifyChatSearchIntention(messages);
//         intention = newIntention; 
//         fullRes = fullResponse
//         // console.log({fullRes})

//         // Guardar la intención y el mensaje completo en el último mensaje
//         messages[messages.length - 1].content = intention; // Guardar la intención (product_search, document_search)
//         messages[messages.length - 1].intention = fullResponse; // Guardar la respuesta completa
//     }

//     let response;
//     if (intention === 'product_search') {
//         response = await searchInAlgolia(messages[messages.length - 1].content);
//     } else if (intention === 'document_search') {
//         response = await searchInTempVectorDB(sessionId, messages[messages.length - 1].content);
//     } else {
//         response = "Lo siento, no pude encontrar como contestar a tu solicitud.";
//     }

//     return { intention, fullRes, response };
// };

// const handleUserQuery = async (sessionId, messages) => {
//     const { fullResponse, intention } = await classifyChatSearchIntention(messages);
//     let response = intention === 'unknown' ? "Lo siento, no pude encontrar como contestar a tu solicitud." : fullResponse;
    

//     if (intention === 'product_search') {
//         response = await searchInAlgolia(messages[messages.length - 1].content);
//     } else if (intention === 'document_search') {
//         response = await searchInTempVectorDB(sessionId, messages[messages.length - 1].content);
//     } else {
//         response = "Lo siento, no pude encontrar como contestar a tu solicitud.";
//     }

//     return { intention, fullRes, response , response};

// };

const handleUserQuery = async (sessionId, messages) => {
    const { fullResponse, intention } = await classifyChatSearchIntention(messages);

    let response = fullResponse;

    if (intention === 'product_search') {
        response = await searchInAlgolia(messages[messages.length - 1].content);
    } else if (intention === 'document_search') {
        response = await searchInVectorDB(sessionId, messages[messages.length - 1].content);
    } else {
        response = "Lo siento, no pude encontrar como contestar a tu solicitud.";
    }

    return { intention, fullRes: fullResponse, response };
};

export {
    handleUserQuery,
};