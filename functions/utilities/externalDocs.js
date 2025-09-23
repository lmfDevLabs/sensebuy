// node modules
import fs from 'fs';
// node-fetch (solo compatible con ESM)
import fetch from 'node-fetch';
// cheerio (default export en ESM)
import * as cheerio from 'cheerio';
// pdf
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
// xlsx
import xlsx from 'xlsx'

// storage helpers
import { downloadFileBufferFromFirebaseUrl, isFirebaseStorageUrl } from './cloudStorage.js';

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
const DEFAULT_PDF_DOWNLOAD_TIMEOUT_MS = 20000;

const sanitizeUrlForLogs = (urlObj) => {
  const clone = new URL(urlObj.toString());
  if (clone.searchParams.has('token')) {
    clone.searchParams.set('token', '[redacted]');
  }
  return clone.toString();
};

const createPdfNetworkError = (error, sanitizedUrl, timeoutMs) => {
  if (error.name === 'AbortError') {
    const abortError = new Error(`[PDF Download] Request to ${sanitizedUrl} timed out after ${timeoutMs}ms.`);
    abortError.code = 'ETIMEDOUT';
    abortError.cause = error;
    return abortError;
  }

  if (error.code === 'ECONNREFUSED') {
    const connError = new Error(`[PDF Download] Connection refused while requesting ${sanitizedUrl}. Verify the host and port are reachable.`);
    connError.code = 'ECONNREFUSED';
    connError.cause = error;
    return connError;
  }

  if (error.code === 'ETIMEDOUT') {
    const socketTimeoutError = new Error(`[PDF Download] Network timeout while fetching ${sanitizedUrl}.`);
    socketTimeoutError.code = 'ETIMEDOUT';
    socketTimeoutError.cause = error;
    return socketTimeoutError;
  }

  const genericError = new Error(`[PDF Download] Network error while fetching ${sanitizedUrl}: ${error.message}`);
  if (error.code) {
    genericError.code = error.code;
  }
  genericError.cause = error;
  return genericError;
};

const ensurePdfContentType = (contentType, sanitizedUrl, sourceLabel) => {
  const normalizedContentType = (contentType || '').toLowerCase();
  if (!normalizedContentType.includes('application/pdf')) {
    const error = new Error(`[${sourceLabel}] Invalid content-type for ${sanitizedUrl}. Expected application/pdf but received ${contentType || 'unknown'}.`);
    error.code = 'UNEXPECTED_CONTENT_TYPE';
    console.error(error.message);
    throw error;
  }
};

const downloadDocFromExternalUrl = async (url, options = {}) => {
  const { timeoutMs = DEFAULT_PDF_DOWNLOAD_TIMEOUT_MS } = options;

  if (!url || typeof url !== 'string') {
    throw new Error('A valid URL must be provided to download a document.');
  }

  const trimmedUrl = url.trim();

  if (isFirebaseStorageUrl(trimmedUrl)) {
    const { buffer, contentType, sanitizedUrl } = await downloadFileBufferFromFirebaseUrl(trimmedUrl, { timeoutMs });
    ensurePdfContentType(contentType, sanitizedUrl, 'Firebase Storage');
    return buffer;
  }

  let urlObj;
  try {
    urlObj = new URL(trimmedUrl);
  } catch (error) {
    throw new Error(`Invalid URL provided: ${url}`);
  }

  const sanitizedUrl = sanitizeUrlForLogs(urlObj);
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

  let response;

  try {
    response = await fetch(urlObj.toString(), {
      method: 'GET',
      signal: controller.signal,
    });
  } catch (error) {
    const networkError = createPdfNetworkError(error, sanitizedUrl, timeoutMs);
    console.error(networkError.message);
    throw networkError;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const httpError = new Error(`[PDF Download] HTTP ${response.status} ${response.statusText} while fetching ${sanitizedUrl}.`);
    httpError.status = response.status;
    httpError.code = `HTTP_${response.status}`;
    console.error(httpError.message);
    throw httpError;
  }

  const contentType = response.headers.get('content-type') || '';
  ensurePdfContentType(contentType, sanitizedUrl, 'PDF Download');

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
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
