// firebase
const { 
    db,  
} = require('../../firebase/admin')

// utilities
const { 
    createChatMessage,  
    getChatMessages
} = require('../../utilities/firestore');

const { 
    searchInAlgolia,  
} = require('../../utilities/algolia');

const { 
    generateAIResponse,
    handleUserQuery 
} = require('../../utilities/openAi');

const chats = async (req, res) => {
    const userId = req.user.uid;
    const userQuery = req.body.userQuery;
    let sessionId = req.body.sessionId;

    // Si no se proporciona un sessionId, creamos uno nuevo
    if (!sessionId || sessionId.trim() === "") {
        const newSessionDoc = db.collection('chats').doc(userId).collection('sessions').doc();
        sessionId = newSessionDoc.id;
    }

    let messages = [];

    try {
        // Guardar el mensaje inicial del usuario
        await createChatMessage(userId, sessionId, 'user', userQuery);
        
        // Obtener los mensajes de chat anteriores
        const previousMessages = await getChatMessages(userId, sessionId);
        
        // Añadir los mensajes anteriores al array de mensajes
        previousMessages.forEach(msg => {
            messages.push({
                role: msg.role,
                content: msg.content,
                intention:msg.intention
            });
        });

        // Añadir el mensaje del usuario actual al array de mensajes
        messages.push({ role: 'user', content: userQuery });

        // Generar respuesta del asistente basado en la intención clasificada
        const { response: assistantResponse, intention } = await handleUserQuery(messages);

        // Guardar la respuesta del asistente en Firebase
        await createChatMessage(userId, sessionId, 'assistant', assistantResponse, intention);

        // Añadir la respuesta del asistente al array de mensajes
        messages.push({ role: 'assistant', content: assistantResponse, intention });
        // console.log({messages})
        // Responder con los mensajes obtenidos y la intención
        res.json({ sessionId, intention });
    } catch (error) {
        console.error('Error handling chat entry:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    chats
};

// User queries with OpenAI and Algolia
// exports.chatWithOpenAIAndAlgolia = async (req, res) => {
//     // final response
//     let assistantResponse = '';
//     // Array of messages
//     let messages = [
//         {
//             role: 'system',
//             content: `Instrucciones 1: 
//             Tu eres un asistente de ventas de una gran feria de automotores. Responde 
//             de manera amable y en un tono de ayuda.

//             Por favor pregunta cosas útiles al usuario para ayudarlos a encontrar
//             el automotor que buscan en su visita a dicha feria.

//             Responde a las preguntas del usuario e identifica en sus peticiones, las palabras clave relevantes
//             para una búsqueda de productos (como tipo de automóvil, color, marca entre otras varias 
//             típicas características que podrían atribuirse a un automotor). 
//             `
//         }
//     ];
    
//     // Function that integrates OpenAI and Firebase to answer a question
//     const handleUserMessage = async (userId, sessionId, userAskQuery) => {
//         try {
//             // Agregar el mensaje del usuario al historial
//             messages.push({ 
//                 role: "user", 
//                 content: userAskQuery 
//             });

//             // Guardar el mensaje del usuario en Firebase
//             await createChatMessage(userId, sessionId, "user", userAskQuery);

//             // Obtener la respuesta del asistente 1
//             assistantResponse = await generateAIResponse(messages);

//             // Guardar la respuesta del asistente en Firebase
//             await createChatMessage(userId, sessionId, "assistant", assistantResponse);

//             // Agregar la respuesta del asistente al historial
//             messages.push({ role: "assistant", content: assistantResponse });

//             // Instrucciones adicionales para el asistente
//             messages.push({ 
//                 role: "system", 
//                 content: `Instrucciones 2:
//                 Con base ÚNICAMENTE en los mensajes enviados por los usuarios, debes identificar MINIMO TRES 
//                 palabras clave que ESRICTAMENTE tengan que ver con los automotores y retornar una lista de estas 
//                 palabras clave explícitamente.
                
//                 Es decir se requiere que; generes de una lista de minimo tres palabras clave que hablen solo de automotores.
//                 Ejemplo: keywords:['sedán', 'rojo', 'toyota', 'camry', '2021'].
                
//                 Estas palabras clave no deben ser parte de la respuesta que le das al usuario.
//                 Pero sí servirán para busquedas posteriores en Algolia.
                
//                 Una vez esto suceda, se te dara una lista de productos sobre la que se espera puedas ayudar 
//                 al usuario a encontrar lo que busca. Esta lista sera el resultado de una busqueda que 
//                 se realizara con los terminos clave que suministraste.
//                 `
//             });

//             // Obtener la respuesta del asistente 2
//             const assistantResponse2 = await generateAIResponse(messages);
//             console.log({assistantResponse2});

//             // Limpiar las palabras clave
//             const cleanedKeywords = assistantResponse2.replace(/keywords:| /g, '');
//             console.log({cleanedKeywords});
            
//             // return
//             return { assistantResponse, cleanedKeywords };
//         } catch (error) {
//             console.error("Error al obtener respuesta de OpenAI:", error);
//         }
//     }

//     // Manejar la solicitud del usuario
//     try {
//         const userAskQuery = req.body.askQuery;
//         const userType = req.user.type;
//         const userId = req.user.uid;
//         const sessionId = req.params.sessionId; // Asumiendo que el sessionId es proporcionado en la solicitud
//         // main
//         const { assistantResponse, cleanedKeywords } = await handleUserMessage(userId, sessionId, userAskQuery);
//         // algolia
//         const searchAtAlgolia = await searchInAlgolia(openAIResponse);

//         res.json({ message: assistantResponse });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// } 