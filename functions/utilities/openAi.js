const { OpenAI } = require('openai');

// OpenAI credentials
const openai = new OpenAI({
    organization: process.env.OPENAI_ORGANIZATION,
    apiKey: process.env.OPENAI_API_KEY,
}); 

// OpenAI function response
const generateAIResponse = async (messages) => {
    console.log("generateAIResponse");
    try {
        const responseAI = await openai.chat.completions.create({
            model: "gpt-4",
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

        return responseAI.choices[0].message.content.trim();
    } catch (error) {
        console.error("Error al obtener respuesta de OpenAI:", error);
        throw error;
    }
};

// clasificador de intenciones para direccionamiento de Algolia o búsqueda vectorial
const classifyChatSearchIntention = async (messages) => {
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
    `;

    const formattedMessages = [
        { 
            role: "system", 
            content: systemMessage
        },
        ...messages.map(msg => ({
            role: msg.role, 
            content: msg.content === "Lo siento, no pude encontrar como contestar a tu solicitud." ? msg.fullRes : msg.content
        }))
    ];

    try {
        const fullResponse = await generateAIResponse(formattedMessages);
        console.log({ fullResponse });

        // Extraer la intención (product_search o document_search) de la respuesta completa
        let intention;
        if (fullResponse.includes("product_search")) {
            intention = "product_search";
        } else if (fullResponse.includes("document_search")) {
            intention = "document_search";
        } else {
            intention = "unknown";
        }

        return { 
            fullResponse, 
            intention 
        };
    } catch (error) {
        console.error("Error al clasificar la intención de búsqueda:", error);
        throw error;
    }
};





module.exports = {
    generateAIResponse,
    classifyChatSearchIntention,
};