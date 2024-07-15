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
                // loop
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
                    else if (newKey === 'price_($)' && /^[0-9.]+$/.test(value)) {
                        car[newKey] = parseFloat(value);
                    } 
                    // Convierte números con puntos (decimales)
                    else if (/^-?\d+(\.\d+)?$/.test(value)) { 
                        car[newKey] = parseFloat(value);
                    }
                    // convierte a minúsculas excepto para "pdf" y "pics"
                    else if (newKey !== 'pdf' && newKey !== 'pics') {
                        car[newKey] = value.toLowerCase();
                    } else {
                        car[newKey] = value;  // Mantener el valor original para "pdf" y "pics"
                    }
                }
                dataObject.push(car);
            })
            .on('end', () => resolve(dataObject))
            .on('error extractDataFromCSV:', reject);
    });
};

