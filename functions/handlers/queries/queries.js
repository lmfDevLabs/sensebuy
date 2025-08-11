// firebase 
// import { db, admin, storage } from '../../firebase/admin.js';
import { db, storage } from '../../firebase/admin.js';
// open ai
import { OpenAI } from 'openai';
// algolia
import {algoliasearch} from 'algoliasearch';
// dotenv
import dotenv from 'dotenv';
dotenv.config();

// Global array for keywords
let globalKeywords = [];

// User queries with OpenAI and Firebase with tags pool
const queriesOpenAI = async (req, res) => {
    // OpenAI credentials
    const openai = new OpenAI({
        organization: process.env.OPENAI_ORGANIZATION,
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Array of messages
    let messages = [
        { 
            role: "system", 
            content: "Este es tu asistente que te ayudará a encontrar el vehiculo que buscas." 
        },
    ];

    // Keywords extractor from tags pool
    const getTagsFromShowroom = async (showroomId) => {
        try {
            const showroomRef = db.collection('showRooms').doc(showroomId);
            const doc = await showroomRef.get();

            if (!doc.exists) {
                console.log('No such document!');
                return [];
            } else {
                const showroomData = doc.data();
                return showroomData.tags || [];
            }
        } catch (error) {
            console.error('Error getting document:', error);
            return [];
        }
    };

    // Function to filter keywords
    const filterKeywords = (userInput, tags) => {
        const normalizedInput = userInput.toLowerCase().split(/\s+/);
        return normalizedInput.filter(word => tags.includes(word));
    };

    // Function to search products by name
    const productFirebaseSearcher = async (tag) => {
        const productsRef = db.collection('products');
        const query = productsRef.where('tags', 'array-contains', tag);
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
            return 'No se encontraron productos con ese nombre.';
        }
        
        let results = 'Resultados:\n';
        querySnapshot.forEach(doc => {
            results += `${doc.data().name} - ${doc.data().price}\n`;
        });
        
        return results;
    };

    // Function that integrates OpenAI and Firebase to answer a question
    const handleUserMessage = async (userInput, showroomId) => {
        // Add user message to the history
        messages.push({ role: "user", content: userInput });

        try {
            let assistantResponse = '';
            // Generate response with OpenAI
            const responseAI = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages,
                temperature: 1,
                max_tokens: 100,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });

            if (!responseAI || !responseAI.choices || responseAI.choices.length === 0) {
                throw new Error("Invalid response from OpenAI");
            }

            // Add OpenAI response to the history
            assistantResponse = responseAI.choices[0].message.content;
            messages.push({ role: "assistant", content: assistantResponse });

            // Extract keywords
            const tags = await getTagsFromShowroom(showroomId);
            const newKeywords = filterKeywords(userInput, tags);

            // Add new keywords to the global array
            globalKeywords = [...globalKeywords, ...newKeywords];
            console.log("Global keywords:", globalKeywords);
            // Search products in Firebase if enough keywords are gathered
            if (globalKeywords.length >= 3) {
                const resultsFirebase = await Promise.all(globalKeywords.map(keyword => productFirebaseSearcher(keyword)));
                let finalResponse = assistantResponse;
                if (resultsFirebase.length > 0) {
                    finalResponse += "\n\nAdemás, basado en tu consulta, encontré esto en nuestra base de datos:\n" + resultsFirebase.join("\n");
                }
                console.log(finalResponse);
                res.json({ message: finalResponse });
            } else {
                console.log("Esperando más palabras clave..");
            }
        } catch (error) {
            console.error("Error obtaining response from OpenAI:", error);
        }
    }

    // Handle user request
    try {
        const userAskQuery = req.body.askQuery;
        const showroomId = req.body.showRoomId;
        await handleUserMessage(userAskQuery, showroomId);
        res.json({ message: assistantResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// User queries with OpenAI and Algolia
const queriesOpenAIAndAlgolia = async (req, res) => {
    // final response
    let assistantResponse = '';
    let delimiter = "###"
    // Array of messages
    let messages = [
        {
            role: 'system',
            content: `Instrucciones 1: 
            Tu eres un asistente de ventas de una gran feria de automotores. Responde 
            de manera amable y en un tono de ayuda.

            Por favor pregunta cosas útiles al usuario para ayudarlos a encontrar
            el automotor que buscan en su visita a dicha feria.

            Responde a las preguntas del usuario e identifica en sus peticiones, las palabras clave relevantes
            para una búsqueda de productos (como tipo de automóvil, color, marca entre otras varias 
            típicas características que podrían atribuirse a un automotor). 
            `
        }
    ];

    // Chats CRUD operations
    // post message
    const createMessage = async (userType, role, userId, userAskQuery) => {
        // timestamp
        const timestamp = new Date().toISOString();
        
        // db
        try {
            if (userType === 'buyer') {
                if (role === 'user') {
                    await db.collection('chats').doc(userId).collection('messages').add({
                        role: 'user',
                        content: userAskQuery,
                        timestamp: timestamp,
                    });
                    console.log('Mensaje de usuario guardado en Firebase');
                } else if (role === 'assistant') {
                    await db.collection('chats').doc(userId).collection('messages').add({
                        role: 'assistant',
                        content: userAskQuery,
                        timestamp: timestamp,
                    });
                    console.log('Mensaje de asistente guardado en Firebase');
                }
            } else {
                console.log('El usuario no es un comprador');
            }
        } catch (error) {
            console.error('Error al obtener mensajes:', error);
            throw error;
        }
    }

    // get messages
    const getMessages = async (userId) => {
        
        try {
            const messages = await db.collection('chats').doc(userId).collection('messages').orderBy('timestamp').get();
            const messagesData = messages.docs.map(doc => doc.data());
            return messagesData;
        } catch (error) {
            console.error('Error al obtener mensajes:', error);
            throw error;
        }
    }
    
    // OpenAI function response
    const generateAIResponse = async (messages) => {
         // OpenAI credentials
        const openai = new OpenAI({
            organization: process.env.OPENAI_ORGANIZATION,
            apiKey: process.env.OPENAI_API_KEY,
        });
        try {
            const responseAI = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages,
                temperature: 1,
                max_tokens: 100,
                top_p: 1,
                frequency_penalty: 0,
                presence_penalty: 0,
            });
    
            if (!responseAI || !responseAI.choices || responseAI.choices.length === 0) {
                throw new Error("Respuesta inválida de OpenAI");
            }
    
            return responseAI.choices[0].message.content;
        } catch (error) {
            console.error("Error al obtener respuesta de OpenAI:", error);
            throw error;
        }
    };
    
    // Function that integrates OpenAI and Firebase to answer a question
    const handleUserMessage = async (userType, userId, userAskQuery) => {
        
        try{
            // Agregar el mensaje del usuario al historial
            messages.push({ 
                role: "user", 
                content: userAskQuery 
            });

            // Guardar el mensaje del usuario en Firebase
            await createMessage(
                userType,
                "user",
                userId,
                userAskQuery
            );

            // Obtener todos los mensajes de la conversación
            // const conversationMessages = await getMessages(userId);
            
            // Imprimir
            // console.log({conversationMessages});
            
            // Obtener la respuesta del asistente 1
            assistantResponse = await generateAIResponse(messages);

            // Imprimir
            // console.log({assistantResponse});

            // Guardar la respuesta del asistente en Firebase
            await createMessage(
                userType,
                "assistant",
                userId,
                assistantResponse
            );

            // Agregar la respuesta del asistente al historial
            messages.push({ role: "assistant", content: assistantResponse });
            
            // Imprimir
            // console.log({messages});

            // Pasar el nuevo sistema de mensajes al historial
            // messages[0] = { 
            //     role: "system", 
            //     content:`Instrucciones 2:
            //     Con base ÚNICAMENTE en los mensajes enviados por los usuarios, debes identificar las palabras clave
            //     y retornar una lista de estas palabras clave explícitamente desde el inicio del chat, 
            //     para su uso posterior en una búsqueda. 
            //     Es decir, se requiere que generes de una lista de palabras clave.
            //     Ejemplo: keywords = ['sedán', 'rojo', 'toyota', 'camry', '2021'].
            //     Estas palabras clave no deben ser parte de la respuesta que le das al usuario.
            //     Pero sí servirán para pasos posteriores.
                
            //     Una vez esto suceda, se te dara una lista de productos sobre la que se espera puedas ayudar 
            //     al usuario a encontrar lo que busca. Esta lista sera el resultado de una busqueda que 
            //     se realizara con los terminos clave que suministraste.
            //     `
            // };
            
            messages.push({ 
                role: "system", 
                content: `Instrucciones 2:
                Con base ÚNICAMENTE en los mensajes enviados por los usuarios, debes identificar MINIMO TRES 
                palabras clave que ESRICTAMENTE tengan que ver con los automotores y retornar una lista de estas 
                palabras clave explícitamente.
                
                Es decir se requiere que; generes de una lista de minimo tres palabras clave que hablen solo de automotores.
                Ejemplo: keywords:['sedán', 'rojo', 'toyota', 'camry', '2021'].
                
                Estas palabras clave no deben ser parte de la respuesta que le das al usuario.
                Pero sí servirán para busquedas posteriores en Algolia.
                
                Una vez esto suceda, se te dara una lista de productos sobre la que se espera puedas ayudar 
                al usuario a encontrar lo que busca. Esta lista sera el resultado de una busqueda que 
                se realizara con los terminos clave que suministraste.
                `
            });

            // Obtener la respuesta del asistente 2
            const assistantResponse2 = await generateAIResponse(messages);
            console.log({assistantResponse2});

            // Imprimir
            // console.log({messages});
            
            // clean keywords
            const cleanedKeywords = assistantResponse2.replace(/keywords:| /g, '');
            
            // Imprimir
            console.log({cleanedKeywords});
            return cleanedKeywords;
        } catch (error) {
            console.error("Error al obtener respuesta de OpenAI:", error);
        }
    }

    // to count words
    const countElementsInBrackets = (inputString) => {
        // Utilizar una expresión regular para extraer la parte entre corchetes
        let insideBrackets = inputString.match(/\['(.*?)'\]/);
        
        // Verificar si se encontró la parte entre corchetes
        if (insideBrackets && insideBrackets[1]) {
            // Dividir la parte entre corchetes por comas y contar elementos
            let elementsCount = insideBrackets[1].split(',').length;
            return elementsCount;
        } else {
            // Devolver 0 si no se encuentran elementos
            return 0;
        }
    }
    
    // Ejemplo de función que realiza una búsqueda en Algolia
    const searchInAlgolia = async (searchTerms) => {
        try {
            // Cliente
            const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_ADMIN_KEY);
            // Índice
            const index = client.initIndex('SenseBuy');
            const response = await index.search(searchTerms, {
            // Opciones adicionales aquí si es necesario
            });
            // formatear la respuesta
            let algoliaResultsText = 'Acá algunos resultado que te podrían interesar:\n\n';
            // Recorrer los resultados
            response.hits.forEach((result, index) => {
                algoliaResultsText += `Resultado ${index + 1}:\n`;
                algoliaResultsText += `Nombre: ${result.name}\n`;
                algoliaResultsText += `Concesionario: ${result.companyName}\n`;
                algoliaResultsText += `Descripción: ${result.shortDescription}\n`;
                algoliaResultsText += `Chasis: ${result.taxonomy.chasis_type}\n`;
                algoliaResultsText += `Año: ${result.taxonomy.year}\n`;
                algoliaResultsText += `Color: ${result.taxonomy.color}\n\n`;
                algoliaResultsText += `Precio: ${result.price}\n\n`;
            });
            // Imprimir
            console.log(response.hits);
            // Agrega los resultados de Algolia como un mensaje en el historial de mensajes
            messages.push({ role: "assistant", content: algoliaResultsText });
            // Imprimir
            // console.log({messages});
            // return response.hits; // 'hits' contiene los resultados de la búsqueda
            // pasar la respuesta del asistente
            assistantResponse = algoliaResultsText;
            // send response
            // res.json({ message: assistantResponse });
        } catch (error) {
            console.error('Error al buscar en Algolia:', error);
            throw error;
        }
    };

    // Manejar la solicitud del usuario
    try {
        // user query
        const userAskQuery = req.body.askQuery;
        // Datos de autenticación
        const userType = req.user.type;
        const userId = req.user.uid;
        // Ejecutar la función principal
        const openAIResponse = await handleUserMessage(userType, userId, userAskQuery);
        // const searchAtAlgolia = countElementsInBrackets(openAIResponse) >= 3 && await searchInAlgolia(openAIResponse);
        const searchAtAlgolia = await searchInAlgolia(openAIResponse);
        // send response
        res.json({ message: assistantResponse });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    
}

export {
    queriesOpenAI,
    queriesOpenAIAndAlgolia
};






