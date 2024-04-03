// node modules
const fs = require('fs');
// csv
const csv = require('csv-parser');

// convert excel to csv
exports.convertExcelToCSV = async (filepath) => {
    try {
        console.log('convertExcelToCSVAndCreateNewPath');
        const xlsx = require('xlsx');

        // Lee el archivo Excel
        const workbook = xlsx.readFile(filepath);

        // Obtiene el nombre de la primera hoja
        const firstSheetName = workbook.SheetNames[0];

        // Convierte la hoja a formato CSV
        const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);

        // Crea el nuevo nombre del archivo, reemplazando la extensión
        const newFilepath = filepath.replace(/\.(xls|xlsx)$/, '.csv');

        // Escribe el archivo CSV
        fs.writeFileSync(newFilepath, csvData);

        return newFilepath;
    } catch (error) {
        console.error('Error convertExcelToCSVAndCreateNewPath:', error);
        throw error;
    }
};
// extract csv data
exports.extractDataFromCSV = (filepath) => {
    console.log('extractDataFromCSV');
    return new Promise((resolve, reject) => {
        const dataObject = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => {
                let car = {};
                for (const key in row) {
                    // to trim the values
                    let value = row[key].trim();
                    // to lower case keys and trim the values
                    let newKey = key.toLowerCase().trim();
                    // Convierte "null" a null
                    if (value.toLowerCase() === "null") {
                        car[newKey] = null;
                    } 
                    // Manejo especial para el campo "price"
                    else if (newKey === 'price' && /^[0-9.]+$/.test(value)) {
                        car[newKey] = parseInt(value.replace(/\./g, ''), 10);
                    } 
                    // Convierte números con puntos (decimales)
                    else if (/^-?\d+(\.\d+)?$/.test(value)) {
                        car[newKey] = parseFloat(value);
                    }
                    // convierte a minúsculas
                    else {
                        car[newKey] = value.toLowerCase();
                    }
                }
                dataObject.push(car);
            })
            .on('end', () => resolve(dataObject))
            .on('error extractDataFromCSV:', reject);
    });
};
// Actualizar archivo CSV global añadiendo contenido nuevo
exports.updateGlobalCsvFile = async (embeddingsFilePath, embeddings) => {
    try {
        console.log('updateGlobalCsvFile:');

        // Genera el contenido CSV a partir del array 'embeddings' o usa la cadena directamente si no es un array
        const csvContent = Array.isArray(embeddings)
            ? embeddings.map(embedding => Object.values(embedding).join(',')).join('\n')
            : embeddings; // Si no es un array, se asume que 'embeddings' ya es una cadena en formato CSV

        console.log({csvContent});
    
        // Añade el contenido CSV al archivo existente
        await fs.promises.appendFile(embeddingsFilePath, csvContent + '\n'); // Añade una nueva línea al final, por si acaso

    } catch (err) {
        console.error('Error al actualizar el archivo CSV global', err);
    }
};
