const fs = require('fs').promises; // Importa el módulo 'fs' con promesas
// open ai
const { OpenAI } = require('openai');

// remueve las claves que no queremos en el embedding
const prepareTextForEmbedding = (productData) => {
    try {
        console.log('prepareTextForEmbedding');
        const excludedKeys = ['pics', 'pdf']; // Claves que quieres excluir
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

        // Unir todas las partes con un punto y espacio como separador.
        return textParts.join('. ');
    } catch (error) {
        console.error('Error prepareProductTextForEmbedding:', error);
        return ''; // Devuelve una cadena vacía en caso de error.
    }
};
// Función para obtener embeddings con OpenAI
const getEmbeddingsFromOpenAI = async (text) => {
    
    try {
        // print
        console.log('getEmbeddingsFromOpenAI:');
        // Instancia de OpenAI
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        // Obtiene el embedding del texto
        const response = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float",
        });
        // Asegúrate de acceder correctamente a la respuesta para obtener el embedding
        // console.log('Embedding:', response);
        return response // Ajusta según la estructura de la respuesta
    } catch (error) {
        console.error('Error getEmbeddingsFromOpenAI:', error);
        return null; // O maneja el error según prefieras
    }
};  

// Función para procesar el CSV y generar embeddings
const processCSVAndGenerateEmbeddings = async (
        data,
        sellerId,
        companyName,
        productIdToFirestore // array
    ) => {
    try {  
        // print  
        console.log('processCSVAndGenerateEmbeddings:');
        // Array para almacenar los embeddings
        const embeddings = [];
        // Procesa cada producto y obtiene su embedding
        for (let i = 0; i < data.length; i++) {
            // console.log('Product data:', productData);
            // Prepara el texto del producto para el embedding y obtén el embedding
            const embedding = await getEmbeddingsFromOpenAI(await prepareTextForEmbedding(data[i]));
            if (embedding) { 
                embeddings.push({
                    companyName,
                    sellerId,
                    embedding,
                    productId:productIdToFirestore[i]
                }); // Asocia el embedding con el ID del vendedor
            }
        }
        return embeddings; // Retorna el embedding
    } catch (error) {
        console.error('Error processCSVAndGenerateEmbeddings:', error);
    }
};

// make array with embeddings to save on bucket
const createArrayWithEmbeddings = async (embeddings) => {
    
    try {
        console.log('createArrayWithEmbeddings:');
        let csvContent = []; // Encabezado del CSV

        // Procesa cada embedding y agrégalo al archivo CSV
        embeddings.forEach((item) => {
            // Asegúrate de que item.embedding.data sea un array y tenga elementos antes de continuar
            if (Array.isArray(item.embedding.data) && item.embedding.data.length > 0) {
                // Accede al valor de cada elemento del array data 
                for (const value of item.embedding.data) {
                    // Agrega el valor (escape special characters if needed)
                    csvContent.push({
                        vector:value,
                        sellerId:item.sellerId,
                        companyName:item.companyName,
                        productId:item.productId,
                    }); 
                }
            } else {
                console.error('Error: item.embedding.data is not an array or is empty', item.embedding.data);
            }
        });
        console.log({csvContent});
        return csvContent;
    } catch (err) {
        console.error('Error createArrayWithEmbeddings:', err);
    }
}

// Actualizar archivo JSON global añadiendo contenido nuevo
const updateGlobalEmbeddingsFile = async (embeddingsFilePath, embeddings) => {
    try {
        console.log('updateJSONFileWithEmbeddings:');

        // Inicializa el array que contendrá los datos existentes y nuevos
        let existingData = [];

        try {
            // Intenta leer el archivo existente
            const data = await fs.readFile(embeddingsFilePath, 'utf8');
            if (data) {
                // Solo parsea si hay datos para evitar errores de JSON vacío
                existingData = JSON.parse(data);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('El archivo no existe, se creará uno nuevo.');
            } else {
                // Si el archivo existe pero está corrupto, lanza un error
                throw new Error('El archivo JSON existente está corrupto o no se puede leer.');
            }
        }

        // Agregar los nuevos embeddings al array existente
        const updatedData = existingData.concat(embeddings);

        // Convertir el array actualizado a un string JSON
        const jsonString = JSON.stringify(updatedData, null, 2);

        // Escribir el string JSON de vuelta al archivo
        await fs.writeFile(embeddingsFilePath, jsonString);
        console.log(`JSON file updated at ${embeddingsFilePath}`);
    } catch (err) {
        console.error('Error updating JSON file:', err);
        // Manejo adicional de errores si se desea
    }
};

// module exports
module.exports = {
    prepareTextForEmbedding,
    getEmbeddingsFromOpenAI,
    processCSVAndGenerateEmbeddings,
    createArrayWithEmbeddings,
    updateGlobalEmbeddingsFile
};