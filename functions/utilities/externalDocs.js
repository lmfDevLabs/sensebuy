// node modules
import https from 'https';
import fs from 'fs';
// node-fetch (solo compatible con ESM)
import fetch from 'node-fetch';
// cheerio (default export en ESM)
import * as cheerio from 'cheerio';
// pdf
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// xlsx
import xlsx from 'xlsx'
import { downloadFileBufferFromFirebaseUrl, parseFirebaseStorageUrl } from './cloudStorage.js';

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
  const firebaseUrlInfo = parseFirebaseStorageUrl(url);
  if (firebaseUrlInfo && process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
    const { buffer, contentType } = await downloadFileBufferFromFirebaseUrl(url, firebaseUrlInfo);

    if (contentType !== 'application/pdf') {
      throw new Error(`Invalid content-type. Expected application/pdf but received ${contentType}`);
    }

    return buffer;
  }

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

// Recibe el buffer de datos del archivo PDF
const extractTextFromPdf = async (pdfBuffer) => {
  try {
    const loadingTask = pdfjs.getDocument({
      data: pdfBuffer,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const parts = [];

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent({ includeMarkedContent: true });
      const text = content.items
        .map((it) => (typeof it.str === 'string' ? it.str : ''))
        .filter(Boolean)
        .join(' ');
      parts.push(text);
    }

    await pdf.cleanup();

    // Normaliza espacios y líneas
    const joined = parts.join('\n').replace(/[ \t]+\n/g, '\n').replace(/\s+/g, ' ').trim();

    // Consistencia: devuelve string (posible vacío). El caller decide si es error.
    return joined;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return ''; // devuelve string vacío en caso de error; el caller lo valida
  }
};


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

export {
  convertExcelToCSV, // <---------
  downloadDocFromExternalUrl, 
  extractTextFromPdf, // <-----------
  extractMeaningfulTextFromHtml, // <-----------
  extractMeaningfulTextFromPdf // <-----------
};
