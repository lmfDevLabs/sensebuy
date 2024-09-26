///////// FIRESTORE 
// Método para extraer valores de un objeto y asegurar que son strings
const outputTags = async (obj) => {
    console.log('outputTaxonomy');
    let arrValues = [];

    // Define las llaves que quieres excluir
    const excludeKeys = ['description', 'pics', 'pdf']; // Llaves a excluir

    // Recorre cada par llave-valor en el objeto
    await Object.entries(obj).forEach(([key, value]) => {
        // Excluye las llaves especificadas
        if (!excludeKeys.includes(key)) {
            // Si el valor es una cadena con comas, lo dividimos y agregamos cada parte al arreglo de valores
            if (typeof value === 'string' && value.includes(',')) {
                const valuesArray = value.split(',').map(item => item.trim());
                arrValues.push(...valuesArray);
            } else {
                arrValues.push(String(value)); // Aseguramos que todos los valores sean strings
            }
        }
    });

    return arrValues;
};

// to crop last part of the url sellers docs path
const removeLastPathSegment = (url) => {
    // Encuentra la posición del último '/'
    const lastSlashIndex = url.lastIndexOf('/');
    // Si no hay '/', retorna la URL original
    if (lastSlashIndex === -1) {
        return url;
    }
    // Retorna la URL sin la última parte del path
    return url.substring(0, lastSlashIndex);
}

// module exports
module.exports = {
    outputTags,
    removeLastPathSegment
};