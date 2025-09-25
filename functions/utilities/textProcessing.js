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

// --------------------------------------------
// Helpers de normalización y análisis
// --------------------------------------------
const normalizeWhitespace = (text) =>
  text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const analyzeText = (text) => {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const lens = paragraphs.map((p) => p.length).sort((a, b) => a - b);
  const sum = lens.reduce((a, b) => a + b, 0);
  const avg = lens.length ? sum / lens.length : 0;
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : 0;
  const p90 = lens.length ? lens[Math.floor(lens.length * 0.9)] : 0;
  const p95 = lens.length ? lens[Math.floor(lens.length * 0.95)] : 0;

  return {
    charsTotal: text.length,
    paragraphs: paragraphs.length,
    avgParagraphLen: Math.round(avg),
    medianParagraphLen: median,
    p90ParagraphLen: p90,
    p95ParagraphLen: p95,
    sampleParagraph: paragraphs[0]?.slice(0, 250) ?? '',
  };
};

const pickParams = (text, opts = {}) => {
  const {
    baseSize = 2200,
    minSize = 1200,
    maxSize = 3000,
    minOverlap = 120,
    maxOverlap = 400,
    targetParas = 2.2,
  } = opts;

  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const lens = paragraphs.map((p) => p.length).sort((a, b) => a - b);
  const median = lens.length ? lens[Math.floor(lens.length / 2)] : baseSize;

  let chunkSize = Math.round(
    Math.min(maxSize, Math.max(minSize, (median || baseSize) * targetParas)),
  );

  let chunkOverlap = Math.round(chunkSize * 0.12);
  chunkOverlap = Math.min(maxOverlap, Math.max(minOverlap, chunkOverlap));

  const separators = ['\n## ', '\n### ', '\n\n', '\n', '. ', ' ', ''];

  return { chunkSize, chunkOverlap, separators };
};

//////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////// LANGCHAIN ///////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////////
// chunking con LangChain basado en parámetros dinámicos
const splitTextWithLangChainDetailed = async (text, manual = {}) => {
  if (!text || typeof text !== 'string') {
    console.warn('⚠️ No valid text provided to splitTextWithLangChain');
    return { chunks: [], documents: [], config: null };
  }

  const auto = pickParams(text);
  const cfg = {
    chunkSize: manual.chunkSize ?? auto.chunkSize,
    chunkOverlap: manual.chunkOverlap ?? auto.chunkOverlap,
    separators: manual.separators ?? auto.separators,
    keepSeparator: true,
  };

  const splitter = new RecursiveCharacterTextSplitter(cfg);
  const docs = await splitter.createDocuments([text]);
  const normalizedDocs = docs.map((d) => ({
    text: normalizeWhitespace(d.pageContent),
    metadata: d.metadata ?? {},
  }));
  const chunks = normalizedDocs.map((d) => d.text);

  console.log(
    `🔎 [Chunking] ${chunks.length} chunks (size=${cfg.chunkSize}, overlap=${cfg.chunkOverlap})`,
  );

  return { chunks, documents: normalizedDocs, config: cfg };
};

const splitTextWithLangChain = async (text, manual = {}) => {
  const { chunks } = await splitTextWithLangChainDetailed(text, manual);
  return chunks;
};

export {
    generateDescriptionCompose,
    prepareTextForEmbedding,
    generateListOfKeyWordsOfProduct, // <----------
    chunkText,
    splitTextWithLangChain, // <----------
    splitTextWithLangChainDetailed,
    normalizeWhitespace,
};
