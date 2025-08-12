// node modules
import https from 'https';
import fs from 'fs';
// node-fetch (solo compatible con ESM)
import fetch from 'node-fetch';
// cheerio (default export en ESM)
import * as cheerio from 'cheerio';
// pdf
import pdfParse from 'pdf-parse';
// xlsx 
import xlsx from 'xlsx'
// langchain
import { Document } from 'langchain/document';
// import { PDFLoader } from 'langchain/document_loaders/fs/pdf';
// import { CheerioWebBaseLoader } from 'langchain/loaders/web/cheerio';


// convert excel to csv <---------
const convertExcelToCSV = async (filepath) => {
  try {
      console.log('convertExcelToCSV');

      // Lee el archivo Excel
      const workbook = xlsx.readFile(filepath);

      // Obtiene el nombre de la primera hoja
      const firstSheetName = workbook.SheetNames[0];

      // Convierte la hoja a formato CSV
      const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[firstSheetName]);

      // Crea el nuevo nombre del archivo, reemplazando la extensión
      const csvFilePath = filepath.replace(/\.(xls|xlsx)$/, '.csv');

      // Escribe el archivo CSV
      fs.writeFileSync(csvFilePath, csvData);
      // console.log({csvFilePath})
      return {csvFilePath};
  } catch (error) {
      console.error('Error convertExcelToCSV:', error);
      throw error;
  }
};

// para descargar y procesar docs desde urls
const downloadDocFromExternalUrl = async (url) => {
  console.log("downloadDocFromExternalUrl");
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Request Failed. Status Code: ${response.statusCode}`));
        response.resume(); // Consume response data to free up memory
        return;
      }

      const contentType = response.headers['content-type'];
      if (contentType !== 'application/pdf') {
        reject(new Error(`Invalid content-type. Expected application/pdf but received ${contentType}`));
        response.resume(); // Consume response data to free up memory
        return;
      }

      const data = [];
      response.on('data', (chunk) => data.push(chunk));
      response.on('end', () => resolve(Buffer.concat(data)));
      response.on('error', reject);
    }).on('error', reject); // Catch errors from https.get
  });
};

// --- Helper Function para extraer texto de HTML (igual que antes) ---
const extractTextFromHtml = async (html)=>{
    try {
        const dom = new JSDOM(html);
        const bodyText = dom.window.document.body.textContent;
        return bodyText ? bodyText.replace(/\s+/g, ' ').trim() : null;
    } catch (error) {
        console.error('Error extracting text from HTML:', error);
        return null;
    }
}

// --- Helper Function para extraer texto de PDF (NUEVA FUNCIÓN) ---
// Recibe el buffer de datos del archivo PDF
const extractTextFromPdf = async (pdfBuffer) => {
    try {
        const data = await pdfParse(pdfBuffer);
        // data.text contiene el texto extraído de todas las páginas
        return data.text ? data.text.replace(/\s+/g, ' ').trim() : null;
    } catch (error) {
        console.error('Error extracting text from PDF:', error);
        return null;
    }
  }



// pdf extractor
const extractMeaningfulTextFromPdf = async (url) => {
  try {
    const pdfBuffer = await downloadDocFromExternalUrl(url);
    const fullText = await extractTextFromPdf(pdfBuffer);

    if (!fullText) {
      return { fullText: "", blocks: [] };
    }

    const blocks = fullText
      .split(/\n{2,}/)
      .map((block) => block.replace(/\s+/g, " ").trim())
      .filter((text) => text.length >= 30);

    return { fullText: blocks.join("\n\n"), blocks };
  } catch (err) {
    console.error(`[PDF Extraction] Error fetching or parsing: ${url}`, err);
    throw err;
  }
};

  // html extractor
const extractMeaningfulTextFromHtml = async (url) => {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Seleccionamos solo bloques sustanciales
    const elements = $('article, section, p, h1, h2, h3, h4, li');

    const seen = new Set();
    const blocks = [];

    elements.each((_, el) => {
      const text = $(el).text().trim();

      if (text.length < 30) return; // descartar texto muy corto
      if (seen.has(text)) return;   // evitar duplicados

      seen.add(text);
      blocks.push(text);
    });

    const fullText = blocks.join('\n\n');

    return { fullText, blocks };

  } catch (err) {
    console.error(`[HTML Extraction] Error fetching or parsing: ${url}`, err);
    throw err;
  }
};




// html document load <-----------
// const loadHtmlDocs = async (url) => {
//   const loader = new CheerioWebBaseLoader(url);
//   const docs = await loader.load();
//   return docs;
// };

// const loadHtmlDocs = async (htmlString) => {
//   const loader = new CheerioWebBaseLoader({
//     html: htmlString,
//   });
//   const docs = await loader.load();
//   return docs.map(doc => doc.pageContent).join('\n');
// }


// const loadHtmlDocs = async (htmlString) => {
//   const $ = cheerio.load(htmlString);

//   // Extrae texto visible (esto puedes ajustarlo según tu caso)
//   const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

//   return [
//     new Document({
//       pageContent: bodyText,
//       metadata: {
//         source: 'cheerio-html',
//       },
//     }),
//   ];
// }

// const loadHtmlDocs = async (htmlString) => {
//   const $ = cheerio.load(htmlString);
//   const bodyText = $('body').text().replace(/\s+/g, ' ').trim();

//   console.log("🔎 [HTML] Extracted text length:", bodyText.length);
//   console.log("🔎 [HTML] Sample:", bodyText.slice(0, 300));

//   return bodyText;
// };



// pdf document load <-----------
// const loadPdfDocs = async (filePath) => {
//   const loader = new PDFLoader(filePath);
//   const docs = await loader.load();
//   return docs;
// };

// const loadPdfDocs = async (pdfBuffer) => {
//   // Crea un archivo temporal si estás usando un buffer
//   const loader = new PDFLoader(new Blob([pdfBuffer]), {
//     splitPages: false,
//   });

//   const docs = await loader.load();

//   // Puedes combinar el contenido si quieres un solo string:
//   return docs.map(doc => doc.pageContent).join('\n');
// };

// const loadPdfDocs = async (buffer) => {
//   try {
//     const data = await pdfParse(buffer);
//     return data.text; // texto completo
//   } catch (err) {
//     console.error("Error parsing PDF:", err);
//     return null;
//   }
// };

// const loadPdfDocs = async (buffer) => {
//   try {
//     const data = await pdfParse(buffer);
//     console.log("🔎 [PDF] Extracted text length:", data.text.length);
//     console.log("🔎 [PDF] Sample:", data.text.slice(0, 300));
//     return data.text;
//   } catch (err) {
//     console.error("❌ Error parsing PDF:", err);
//     return null;
//   }
// };


export {
  downloadDocFromExternalUrl,
  convertExcelToCSV, // <---------
  extractTextFromHtml,
  extractTextFromPdf,
  // loadHtmlDocs, // <-----------
  // loadPdfDocs // <-----------
  extractMeaningfulTextFromHtml,
  extractMeaningfulTextFromPdf
};
