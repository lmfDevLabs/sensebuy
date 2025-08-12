// node modules
import fs from 'fs';
// csv
import csv from 'csv-parser';


// extract csv data
// exports.extractDataFromCSV = (filepath) => {
//     console.log('extractDataFromCSV');
//     return new Promise((resolve, reject) => {
//         const dataObject = [];
//         fs.createReadStream(filepath)
//             .pipe(csv())
//             .on('data', (row) => {
//                 let car = {};
//                 // loop
//                 for (const key in row) {
//                     // to trim the values
//                     let value = row[key].trim();
//                     // to lower case keys and trim the values
//                     let newKey = key.toLowerCase().trim();
//                     // Convierte "null" a null
//                     if (value.toLowerCase() === "null") {
//                         car[newKey] = null;
//                     }  
//                     // Manejo especial para el campo "price"
//                     else if (newKey === 'price_($)' && /^[0-9.]+$/.test(value)) {
//                         car[newKey] = parseFloat(value);
//                     } 
//                     // Convierte números con puntos (decimales)
//                     else if (/^-?\d+(\.\d+)?$/.test(value)) { 
//                         car[newKey] = parseFloat(value);
//                     }
//                     // convierte a minúsculas excepto para "pdf" y "pics"
//                     else if (newKey !== 'pdf' && newKey !== 'pics' && newKey !== 'product_url') {
//                         car[newKey] = value.toLowerCase();
//                     } else {
//                         car[newKey] = value;  // Mantener el valor original para "pdf" y "pics"
//                     }
//                 }
//                 dataObject.push(car);
//             })
//             .on('end', () => resolve(dataObject))
//             .on('error extractDataFromCSV:', reject);
//     });
// };

// extract csv data and caract dicc
const extractDataFromCSV = (filepath) => {
    console.log('extractDataFromCSV');
    return new Promise((resolve, reject) => {
        const dataObject = [];
        let isFirstRow = true;
        let descriptions = {};

        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => {
                if (isFirstRow) {
                    // Primera fila se usa como diccionario de descripciones
                    for (const key in row) {
                        //const newKey = key.toLowerCase().trim();
                        let newKey = key.trim().toLowerCase().replace(/\s+/g, '_');
                        const desc = row[key].trim();
                        descriptions[newKey] = desc;
                    }
                    isFirstRow = false;
                    return; // no agregamos esta fila al dataObject
                }

                let car = {};
                for (const key in row) {
                    let value = row[key].trim();
                    //let newKey = key.toLowerCase().trim();
                    const newKey = key.trim().toLowerCase().replace(/\s+/g, '_');

                    if (value.toLowerCase() === "null") {
                        car[newKey] = null;
                    } else if (newKey === 'price_($)' && /^[0-9.]+$/.test(value)) {
                        car[newKey] = parseFloat(value);
                    } else if (/^-?\d+(\.\d+)?$/.test(value)) {
                        car[newKey] = parseFloat(value);
                    } else if (newKey !== 'pdf' && newKey !== 'pics' && newKey !== 'product_url') {
                        car[newKey] = value.toLowerCase();
                    } else {
                        car[newKey] = value;
                    }
                }
                dataObject.push(car);
            })
            .on('end', () => {
                resolve({
                    data: dataObject,
                    descriptions: descriptions,
                    count: dataObject.length,
                    keys: Object.keys(descriptions).slice(0, 5)
                });
            })
            .on('error', (error) => {
                console.error('Error in extractDataFromCSV:', error);
                reject(error);
            });
    });
};

export {
    extractDataFromCSV
};

