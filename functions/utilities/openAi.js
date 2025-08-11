// langchain
import { ChatOpenAI } from '@langchain/openai';
import { SystemMessage, HumanMessage } from "@langchain/core/messages";

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

// genera "parrafo activo" para cada producto con LLM
const generateProductDescriptionComposeWithLLM = async (itemsArray, systemMessage, exampleParagraph, attributeDictionary) => {
    console.log({generateProductDescriptionComposeWithLLM})
    try {
        const model = new ChatOpenAI({
            temperature: 0.7,
            modelName: "gpt-3.5-turbo",
            openAIApiKey: process.env.OPENAI_API_KEY,
        });
        
        const descriptions = [];
        
        for (const item of itemsArray) {
            // Construcción del cuerpo de atributos con descripciones del diccionario
            let attributeBlock = "A continuación tienes un conjunto de atributos de un producto con su valor:\n\n";
            for (const [key, value] of Object.entries(item)) {
                if (value && attributeDictionary[key]) {
                    attributeBlock += `• ${attributeDictionary[key].descripcion}: ${value}\n`;
                }
            }
        
            // Mensaje compuesto al sistema con ejemplo incluido
            const systemFullMessage = `${systemMessage}
                A continuación, un ejemplo del tipo de descripción que se espera producir:
                "${exampleParagraph}"
                Por favor, redacta una nueva descripción basada en los datos que se te proporcionarán, manteniendo un estilo similar al del ejemplo.`;
        
            const messages = [
                new SystemMessage(systemFullMessage),
                new HumanMessage(attributeBlock)
            ];
        
            try {
                const result = await model.call(messages);
                descriptions.push({
                    input: item,
                    description: result.text.trim()
                });
            } catch (err) {
                console.error("Error generating description for item:", item, err);
                descriptions.push({
                    input: item,
                    description: "ERROR_GENERATING_DESCRIPTION"
                });
            }
        }
        
        return descriptions;
    } catch (error) {
        console.error('Error generateDescriptionCompose:', error);
        return ''; // Devuelve una cadena vacía en caso de error.
    }
    
}

// LLM para procesar un solo documento
const generateParagraphForProduct = async(productData, productName, attributeDictionary, systemMessage, exampleParagraph) => {
    
    console.log(`Generating active paragraph for product in "generateParagraphForProduct": ${productName}`);
    try {
        // Inicializa el modelo dentro de la función o hazlo global si prefieres
        // (Ten en cuenta el manejo de instancias en funciones concurrentes V2)
        const model = new ChatOpenAI({
            temperature: 0.7,
            modelName: "gpt-3.5-turbo", // O gpt-4, etc.
            openAIApiKey: openAIApiKey,
        });

         // Construcción del cuerpo de atributos (similar a tu código)
        let attributeBlock = "A continuación tienes un conjunto de atributos de un producto con su valor:\n\n";
        for (const [key, value] of Object.entries(productData)) {
            // Excluir campos que no son parte de la data tabular o no son relevantes para la narrativa inicial
            if (key !== 'product_url' && value && attributeDictionary && attributeDictionary[key]) {
                attributeBlock += `• ${attributeDictionary[key].descripcion}: ${value}\n`;
            } else if (key !== 'product_url' && value && typeof value === 'string') {
                 // Opcional: incluir campos sin descripción en el diccionario, pero que tengan valor
                attributeBlock += `• ${key}: ${value}\n`;
            }
        }

        if (attributeBlock === "A continuación tienes un conjunto de atributos de un producto con su valor:\n\n") {
                console.warn(`No relevant attributes found for product ${productName} to generate paragraph.`);
            return ""; // Devuelve cadena vacía si no hay atributos relevantes
        }

        // Mensaje compuesto al sistema con ejemplo incluido
        const systemFullMessage = `${systemMessage}
            A continuación, un ejemplo del tipo de descripción que se espera producir:
            "${exampleParagraph}"
            Por favor, redacta una nueva descripción basada en los datos que se te proporcionarán, manteniendo un estilo similar al del ejemplo.`;

        const messages = [
            new SystemMessage(systemFullMessage),
            new HumanMessage(attributeBlock)
        ];

        const result = await model.call(messages);
        const generatedParagraph = result.text.trim();

        console.log(`Paragraph generated for product ${productName}.`);
        return generatedParagraph;

    } catch (error) {
        console.error(`Error generating paragraph for product ${productName}:`, error);
        // Decide cómo manejar errores: podrías retornar un string de error o lanzar
        throw new Error(`Failed to generate paragraph for ${productName}: ${error.message}`); // Lanzar error para que Firebase lo maneje (reintento, etc.)
    }
}

// LLM para procesar un solo documento langchain y langsmith style <-------
const generateParagraphForProductWithLangChain = async (
    productData,
    productName,
    attributeDictionary,
    exampleParagraph
) => {
    
    console.log("generateParagraphForProductWithLangChain")

    // Crear el modelo con el tracer
    const model = new ChatOpenAI({
        temperature: 0.3,
        modelName: "gpt-3.5-turbo",
        openAIApiKey: process.env.OPENAI_API_KEY,
        
    });
    

    // mensaje de sistema
    const systemMessage = new SystemMessage(`
        Eres un generador de descripciones de productos. 
        Esta vez debes hacerlo para "${productName}". 
        Tu tarea es redactar un párrafo descriptivo, 
        claro y fluido, basado en la lista de atributos 
        y una posible nota del vendedor, sobre cualquier 
        particularidad de este que el quiera mencionar. 
        Sigue el estilo del ejemplo SIEMPRE:

        "${exampleParagraph}"

        Ahora recibirás los atributos de un producto. 
        Redacta siempre una nueva descripción consistente con el ejemeplo.`.trim());

    let attributeBlock = `Atributos del producto:\n\n`;

    // loop over products
    for (const [key, value] of Object.entries(productData)) {
        if (key !== "product_url" && key !== "notes_seller" && key !== "PDF" && value) {
            if (attributeDictionary?.[key]) {
                attributeBlock += `• ${attributeDictionary[key].descripcion}: ${value}\n`;
            } else {
                attributeBlock += `• ${key}: ${value}\n`;
            }
        }
    }

    // check if exists notes_seller field
    if (productData.notes_seller) {
        attributeBlock += `\nNota del vendedor:\n"${productData.notes_seller}"\n`;
    }

    // llm call
    const humanMessage = new HumanMessage(attributeBlock);
    let response = await model.invoke([systemMessage, humanMessage]);
    response = response.text.trim();
    // console.log({response})
    return { activeParagraph: response }
};

export {
    generateAIResponse,
    classifyChatSearchIntention,
    generateProductDescriptionComposeWithLLM,
    generateParagraphForProduct, 
    generateParagraphForProductWithLangChain // <-------
};