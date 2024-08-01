const { OpenAI } = require('openai');

// OpenAI credentials
const openai = new OpenAI({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
}); 

// OpenAI function response
const generateAIResponse = async (messages) => {
    try {
        const responseAI = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
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

// clasificador de intenciones para direccionamiento de Algolia o búsqueda vectorial
const classifyChatSearchIntention = async (messages) => {

    // instruccion inicial
    const systemMessage = `
        Eres un asistente IA en un recinto ferial. La feria que se está dando en este momento es el 
        Salón Internacional del Automóvil de Bogotá 2024. La idea es que luego de charlar un rato con el visitante-usuario, 
        puedas clasificar cuál de nuestros métodos de búsqueda funciona mejor para él, 
        para así ayudarlo a encontrar lo que busca en este recinto comercial. 

        Ofrecemos dos opciones por ahora: 
        
        Opción uno: Encontrar un producto puntual, del que el usuario conozca con precisión el nombre o un atributo 
        específico que se pueda buscar mediante Algolia en nuestra base de datos en Firestore. 
        
        Opción dos: Si necesita asistencia más completa, ya que habla de modo muy genérico de eso que busca,
        usamos una búsqueda vectorial en los documentos de los productos disponibles en el recinto ferial, 
        traídos para la venta por los ofertantes. 
        
        TIENES QUE DEVOLVER MÍNIMO UNA OPCIÓN YA SEA: product_search o document_search. 
        ESTO SIEMPRE SE DEBERÁ LOGRAR ANTES DE LA CUARTA INTERACCION EN EL CHAT CON EL USUARIO     
    ` ;
    
        // incoming messages formatted
    const formattedMessages = [
        { 
            role: "system", 
            content: systemMessage
        },
        ...messages.map(msg => ({
            role: msg.role,
            content: msg.content === "Lo siento, no pude entender tu solicitud." ? msg.intention : msg.content
        }))
    ];

    // print
    // console.log("Mensajes enviados a OpenAI para clasificación:", JSON.stringify(formattedMessages, null, 2));

    try {
        const responseAI = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: formattedMessages
        });
        // final intention
        const intention = responseAI.choices[0].message.content.trim();
        console.log({ intention });
        return intention; // 'product_search' or 'document_search' or 'anything'
    } catch (error) {
        console.error("Error al clasificar la intención de búsqueda:", error);
        throw error;
    }
};

// enrutador de medios de búsqueda
const handleUserQuery = async (messages) => {
    // console.log({messages})
    const intention = await classifyChatSearchIntention(messages);
    // to hold response
    let response;
    if (intention === 'product_search') {
        response = await searchInAlgolia(messages[messages.length - 1].content);
    } else if (intention === 'document_search') {
        response = await searchInVectorDB(messages[messages.length - 1].content);
    } else {
        response = "Lo siento, no pude entender tu solicitud.";
    }
    return { response, intention };
};

module.exports = {
    generateAIResponse,
    classifyChatSearchIntention,
    handleUserQuery,
};