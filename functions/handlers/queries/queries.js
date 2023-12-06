// firebase 
const { db, admin, storage } = require('../../firebase/admin');
// open ai
const { OpenAI } = require('openai');

// post new queries from buyers
exports.queries = async (req, res) => {

    // open ai credentials
    const openai = new OpenAI({
        // organization: process.env.OPENAI_ORGANIZATION,
        // apiKey: process.env.OPENAI_API_KEY,
        organization:"org-Ap8hlM5ji63003QXuRBBmveR",
        apiKey:"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"
        
    });

    // get open AI answer
    const generateAnswer = async (askQuery) => {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages:[
                    {
                        role: "system",
                        content: "Este es tu asistente que te ayudará a encontrar el vehiculo que buscas."
                    },
                    {
                        role: "user",
                        content: askQuery,
                    }
                ],
                max_tokens: 100
            });
        
            return response.data.choices[0].text.trim();
        } catch (error) {
            console.error(error);
            return "Lo siento, ocurrió un error al procesar tu pregunta.";
        }
    };

    // keywords extractor from tags pool
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

    // Función para filtrar las palabras clave
    const filterKeywords = (userInput, tags) => {
        const normalizedInput = userInput.toLowerCase().split(/\s+/);
        return normalizedInput.filter(word => tags.includes(word));
    };

    // Función para buscar productos por nombre
    const productFirebaseSearcher = async (tags) => {
        const productsRef = db.collection('products');
        const query = productsRef.where('tags', 'array-contains',tags)
        const querySnapshot = await query.get();
        
        if (querySnapshot.empty) {
            return 'No se encontraron productos con ese nombre.';
        }
        
        let resultados = 'Resultados:\n';
        querySnapshot.forEach(doc => {
            resultados += `${doc.data().name} - ${doc.data().price}\n`;
        });
        
        return resultados;
    };

    // Función que integra OpenAI y Firebase para responder a una pregunta
    const completeAnswer = async (userAskString) => {
        try {
            // Generar respuesta con OpenAI
            const answerAI = await generateAnswer(userAskString);
            
            // Obtener las palabras clave de la respuesta 
            const processUserInput = async (userInput, showroomId) => {
                const tags = await getTagsFromShowroom(showroomId);
                const keywords = filterKeywords(userInput, tags);
                console.log('Filtered Keywords:', keywords);
                return keywords;
            };

            // Procesar las palabras clave
            let tagsResults = await processUserInput(userAskString,req.body.showRoomId)
            
            // Buscar productos en Firebase
            const resultsFirebase = await Promise.all(tagsResults.map(tagsResult => productFirebaseSearcher(tagsResult)));
            
            // Construir la respuesta final
            const finalAnswer = {
                message: `Según mi búsqueda, aquí lo que encontré:`,
                results: resultsFirebase
            };
        
            return finalAnswer;
        } catch (error) {
            console.error(error);
            return {
                message: "Lo siento, ocurrió un error al procesar tu pregunta.",
                error: error.message
            };
        }
    };

    // Manejar la petición del usuario
    try {
        // Obtener la consulta del usuario
        const userAskQuery = req.body.askQuery;
        const totalAnswer = await completeAnswer(userAskQuery);
        
        // Enviar la respuesta al cliente
        res.json(totalAnswer);
    } catch (error) {
        // Enviar una respuesta de error
        res.status(500).json({ error: error.message });
    }
    
}