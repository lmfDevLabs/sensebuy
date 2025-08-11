// stopwords
import stopwords from 'stopwords-es/stopwords-es.json' with { type: 'json' };
// langchain
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';


// genera parrafo "significativo" para cada producto
const generateDescriptionCompose = async (productData) => {

    try {
        const descriptionCompose = 
        `El ${productData['productData_Make'] || 'N/A'} ${productData['productData_Model'] || 'N/A'} del año ${productData['Year'] || 'N/A'} ` +
        `es un vehículo ${productData['Body_Type'] || 'N/A'} disponible en color ${productData['Color_Options'] || 'N/A'}. ` +
        `Está equipado con un motor de ${productData['Engine_Size_(L)'] || 'N/A'} litros, que funciona con ${productData['Fuel_Type'] || 'N/A'}, ` +
        `generando ${productData['Horsepower'] || 'N/A'} caballos de fuerza y ${productData['Torque_(Nm)'] || 'N/A'} Nm de torque. ` +
        `Este modelo puede acelerar de 0 a 60 mph en ${productData['Acceleration_(0-60 mph)'] || 'N/A'} segundos, ` +
        `con una velocidad máxima de ${productData['Top_Speed_(mph)'] || 'N/A'} mph y un rendimiento de combustible de ${productData['Mileage_(MPG)'] || 'N/A'} millas por galón. ` +
        `En cuanto a la seguridad, incluye ${productData['Safety_Features'] || 'N/A'}. ` +
        `El interior cuenta con ${productData['Interior_Features'] || 'N/A'}, ofreciendo confort y tecnología, mientras que el exterior destaca por ${productData['Exterior_Features'] || 'N/A'}, ` +
        `aportando estilo y funcionalidad. Además, incluye productDataacterísticas de entretenimiento como ${productData['Entertainment _Features'] || 'N/A'}. ` +
        `El precio del vehículo es de $${productData['Price_($)'] || 'N/A'}, y tiene una calificación promedio de los clientes de ${productData['Customer_Ratings'] || 'N/A'}.`;

        return descriptionCompose;
    } catch (error) {
        console.error('Error generateDescriptionCompose:', error);
        return ''; // Devuelve una cadena vacía en caso de error.
    }
    // Genera una descripción completa del automóvil a partir de los datos del archivo XLSX
    
}

// remueve las claves que no queremos en el embedding
const prepareTextForEmbedding = async (productData) => {
    try {
        console.log('prepareTextForEmbedding');
        const excludedKeys = ['pics', 'pdf', 'car_driver_url']; // Claves que quieres excluir
        let textParts = [];

        // Recorrer todas las claves y valores del objeto productData
        for (const [key, value] of Object.entries(productData)) {
            // Comprobar si la clave no está excluida y el valor no es nulo ni vacío
            if (!excludedKeys.includes(key) && value) {
                // Convertir la clave de formato snake_case a texto legible
                const readableKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()); // Convierte snake_case a Title Case
                // Agregar la parte de texto al array
                textParts.push(`${readableKey}: ${value}`);
            }
        }
        // creo la descripcion erriquecida
        const descriptionCompose = await generateDescriptionCompose(textParts)
        // Unir todas las partes con un punto y espacio como separador.
        //return textParts.join('. ');
        return descriptionCompose
    } catch (error) {
        console.error('Error prepareProductTextForEmbedding:', error);
        return ''; // Devuelve una cadena vacía en caso de error.
    }
};

// obtener keywords del "parrafo activo final"
const generateListOfKeyWordsOfProduct = async (paragraph) => {
    if (!paragraph || typeof paragraph !== "string") {
        console.error("generateListOfKeyWordsOfProduct recibió un valor inválido:", paragraph);
        return [];
    }
    
    const words = paragraph
    .toLowerCase()
    .replace(/[^a-záéíóúüñ\s]/gi, '')
    .split(/\s+/)
    .filter(word => word && !stopwords.includes(word));

    return Array.from(new Set(words));
}

const MAX_CHUNK_SIZE = 700; // Define tu tamaño de chunk preferido
// chunking
const chunkText = async (text, maxChunkSize) => {
    const chunks = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
        let endPosition = Math.min(currentPosition + maxChunkSize, text.length);

        if (endPosition < text.length) {
            let potentialBreak = text.lastIndexOf(' ', endPosition);
             if (potentialBreak > currentPosition + maxChunkSize * 0.8) {
                endPosition = potentialBreak;
            } else {
                potentialBreak = text.lastIndexOf('\n', endPosition);
                if (potentialBreak > currentPosition + maxChunkSize * 0.8) {
                    endPosition = potentialBreak;
                }
            }
        }

        let chunk = text.substring(currentPosition, endPosition).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        currentPosition = endPosition;
        while (currentPosition < text.length && /\s/.test(text[currentPosition])) {
            currentPosition++;
        }
    }
    return chunks;
} 

//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////// LANGCHAIN ///////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
// chunking with langchain // <----------
// const splitTextWithLangChain = async (text, chunkSize = 700, chunkOverlap = 100) => {
//     const splitter = new RecursiveCharacterTextSplitter({
//         chunkSize,
//         chunkOverlap,
//     });

//     const docsChunks = await splitter.createDocuments([text])
//     return docsChunks.map(doc => doc.pageContent);
// };

const splitTextWithLangChain = async (text, chunkSize = 700, chunkOverlap = 100) => {
    if (!text || typeof text !== "string") {
        console.warn("⚠️ No valid text provided to splitTextWithLangChain");
        return [];
    }

    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap,
    });

    const docsChunks = await splitter.createDocuments([text]);
    console.log(`🔎 [Chunking] Generated ${docsChunks.length} chunks`);

    return docsChunks.map((doc) => doc.pageContent);
};

export {
    generateDescriptionCompose,
    prepareTextForEmbedding,
    generateListOfKeyWordsOfProduct, // <----------
    chunkText,
    splitTextWithLangChain, // <----------
};