import crypto from 'crypto';

import admin from 'firebase-admin';
import { onMessagePublished } from 'firebase-functions/v2/pubsub';

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsPackage from 'pdfjs-dist/package.json' with { type: 'json' };

import { db, storage } from '../firebase/admin.js';
import { splitTextWithLangChainDetailed, normalizeWhitespace } from '../utilities/textProcessing.js';
import { filterChunksByQuality } from '../utilities/chunkQuality.js';
import { computeHash } from '../utilities/hash.js';

const PDF_HEADER = '%PDF-';
const WAIT_ATTEMPTS = 30;
const WAIT_DELAY_MS = 2000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const ensurePdfBuffer = (buffer) => {
  if (!buffer || buffer.length === 0) {
    throw new Error('PDF buffer is empty');
  }
  const header = buffer.slice(0, PDF_HEADER.length).toString('utf8');
  if (!header.startsWith(PDF_HEADER)) {
    throw new Error('Uploaded file is not a valid PDF');
  }
};

const downloadPdfWithRetry = async (bucketName, objectPath) => {
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectPath);

  let metadata = null;
  for (let attempt = 1; attempt <= WAIT_ATTEMPTS; attempt++) {
    const [exists] = await file.exists();
    if (exists) {
      [metadata] = await file.getMetadata();
      const size = Number(metadata?.size ?? 0);
      if (size > 0) break;
    }

    if (attempt === WAIT_ATTEMPTS) {
      throw new Error('PDF not found or empty after waiting for upload');
    }
    await delay(WAIT_DELAY_MS * attempt);
  }

  if (!metadata) {
    throw new Error('Unable to obtain PDF metadata');
  }

  const [buffer] = await file.download();
  ensurePdfBuffer(buffer);

  return { buffer, metadata };
};

const extractTextAndPages = async (buffer) => {
  const loadingTask = pdfjs.getDocument({
    data: buffer,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const perPage = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent({ includeMarkedContent: true });
    const text = content.items
      .map((item) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean)
      .join(' ');
    perPage.push(normalizeWhitespace(text));
  }

  await pdf.cleanup();

  const joiner = '\n\n';
  const baseText = perPage.join(joiner);

  return {
    fullText: baseText,
    perPage,
    pageCount: pdf.numPages,
  };
};

const locateChunks = (baseText, chunks) => {
  const locations = [];
  let cursor = 0;

  chunks.forEach((chunk) => {
    const text = chunk;
    if (!text) {
      locations.push({ start: null, end: null });
      return;
    }

    let index = baseText.indexOf(text, cursor);
    if (index === -1) {
      index = baseText.indexOf(text);
    }

    if (index === -1) {
      locations.push({ start: null, end: null });
      return;
    }

    const start = index;
    const end = index + text.length;
    locations.push({ start, end });
    cursor = end;
  });

  return locations;
};

const buildPageRanges = (baseText, perPage) => {
  const joiner = '\n\n';
  const ranges = [];
  let cursor = 0;

  perPage.forEach((pageText, index) => {
    if (!pageText) {
      ranges.push({ page: index + 1, start: cursor, end: cursor });
      return;
    }

    let start = baseText.indexOf(pageText, cursor);
    if (start === -1) {
      start = baseText.indexOf(pageText);
    }

    if (start === -1) {
      ranges.push({ page: index + 1, start: null, end: null });
      return;
    }

    const end = start + pageText.length;
    ranges.push({ page: index + 1, start, end });
    cursor = end;

    if (baseText.slice(cursor, cursor + joiner.length) === joiner) {
      cursor += joiner.length;
    }
  });

  return ranges;
};

const computeChunkPages = (location, pageRanges) => {
  if (!location || location.start === null || location.end === null) {
    return [];
  }

  const { start, end } = location;
  return pageRanges
    .filter((range) => start < range.end && end > range.start)
    .map((range) => range.page);
};

const buildChunkDoc = ({
  chunk,
  chunkIndex,
  location,
  pages,
  metadata,
  chunkConfig,
  docContext,
}) => {
  const embeddingHash = computeHash(chunk.text);
  const documentId = computeHash(`${metadata.sourceId}:${chunkIndex}`);

  const chunkDoc = {
    sourceId: metadata.sourceId,
    chunkIndex,
    content: chunk.text,
    status: 'pending',
    embeddingStatus: 'pending',
    embeddingHash,
    embeddingModel: null,
    errorMessage: null,
    retries: 0,
    sourceField: 'products-pdf',
    sourceIdentifier: docContext.docPath,
    sourceType: 'pdf',
    qualityScore: chunk.score,
    qualityCategory: chunk.category,
    qualityReasons: chunk.reasons,
    qualityLang: chunk.lang,
    qualityFeatures: chunk.features || null,
    metadata: {
      bucket: metadata.bucket,
      objectPath: metadata.objectPath,
      fileName: metadata.fileName,
      contentType: metadata.contentType,
      pages,
      pageCount: metadata.pageCount,
      charStart: location?.start ?? null,
      charEnd: location?.end ?? null,
      parser: `pdfjs-dist@${pdfjsPackage.version}`,
      sha256: metadata.sha256,
      sizeBytes: metadata.sizeBytes,
      uploadedAt: metadata.uploadedAt,
      userId: metadata.userId,
      docId: docContext.docId,
      docPath: docContext.docPath,
      chunkSize: chunkConfig.chunkSize,
      chunkOverlap: chunkConfig.chunkOverlap,
      droppedCount: metadata.droppedCount,
      emulator: metadata.isEmulator,
      productId: metadata.productId,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  return { documentId, chunkDoc };
};

const chunkPrepFromPdf = onMessagePublished(
  { topic: 'pdf-chunk-prep', region: 'us-central1', timeoutSeconds: 540 },
  async (event) => {
    console.log('chunkPrepFromPdf');
    const message = event.data.message.json || {};
    const { bucket, objectPath, docPath } = message;

    if (!bucket || !objectPath || !docPath) {
      console.warn('chunkPrepFromPdf: missing payload data', message);
      return;
    }

    const docRef = db.doc(docPath);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      console.warn('chunkPrepFromPdf: doc not found', { docPath });
      return;
    }

    const docData = snapshot.data() || {};
    const docId = snapshot.id;

    if (docData.status === 'chunked' || docData?.chunkPrep?.status === 'done') {
      console.log('chunkPrepFromPdf: document already processed', { docPath });
      return;
    }

    await docRef.update({
      status: 'processing',
      'chunkPrep.status': 'processing',
      'chunkPrep.startedAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastError: admin.firestore.FieldValue.delete(),
    });

    try {
      const { buffer, metadata } = await downloadPdfWithRetry(bucket, objectPath);
      const pdfHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const sizeBytes = Number(metadata.size ?? buffer.length);
      const generation = metadata.generation ?? null;
      const sourceId = `gs://${bucket}/${objectPath}${generation ? `#${generation}` : ''}#${pdfHash}`;

      const { fullText, perPage, pageCount } =
        await extractTextAndPages(buffer);

      const normalizedFullText = normalizeWhitespace(fullText);
      if (!normalizedFullText) {
        await docRef.update({
          status: 'empty',
          'chunkPrep.status': 'empty',
          'chunkPrep.completedAt': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn('chunkPrepFromPdf: extracted empty text', { docPath });
        return;
      }

      const { chunks, config } = await splitTextWithLangChainDetailed(
        normalizedFullText,
      );

      if (!chunks.length) {
        await docRef.update({
          status: 'empty',
          'chunkPrep.status': 'empty',
          'chunkPrep.completedAt': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn('chunkPrepFromPdf: no chunks generated', { docPath });
        return;
      }

      const quality = filterChunksByQuality(chunks, { preferLang: 'es' });
      const kept = quality.kept;
      const dropped = quality.dropped;

      if (!kept.length) {
        await docRef.update({
          status: 'skipped',
          'chunkPrep.status': 'skipped',
          'chunkPrep.completedAt': admin.firestore.FieldValue.serverTimestamp(),
          'chunkPrep.droppedCount': dropped.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn('chunkPrepFromPdf: all chunks dropped by quality filter', {
          docPath,
        });
        return;
      }

      const pageRanges = buildPageRanges(normalizedFullText, perPage);
      const locations = locateChunks(normalizedFullText, chunks);

      const chunkMetadata = {
        bucket,
        objectPath,
        fileName: docData.fileName || null,
        contentType: docData.contentType || null,
        sha256: pdfHash,
        sizeBytes,
        uploadedAt: docData.uploadedAt || docData.createdAt || null,
        userId: docData.userId || null,
        pageCount,
        droppedCount: dropped.length,
        sourceId,
        isEmulator: process.env.FUNCTIONS_EMULATOR === 'true',
        productId: docData.productId || null,
      };

      const docContext = { docId, docPath };

      const chunkCollection = db.collection('chunksEmbeddings');
      const chunkEntries = kept.map((chunk) => {
        const chunkIndex = chunk.index;
        const location = locations[chunkIndex] ?? { start: null, end: null };
        const pages = computeChunkPages(location, pageRanges);

        return {
          chunk,
          chunkIndex,
          location,
          pages,
        };
      });

      const docBuilders = chunkEntries.map((entry) =>
        buildChunkDoc({
          chunk: entry.chunk,
          chunkIndex: entry.chunkIndex,
          location: entry.location,
          pages: entry.pages,
          metadata: chunkMetadata,
          chunkConfig: config,
          docContext,
        }),
      );

      const chunkRefs = docBuilders.map(({ documentId }) =>
        chunkCollection.doc(documentId),
      );

      const existingSnapshots = chunkRefs.length
        ? await db.getAll(...chunkRefs)
        : [];

      const existingMap = new Map();
      existingSnapshots.forEach((snap, idx) => {
        if (snap?.exists) {
          existingMap.set(chunkRefs[idx].id, true);
        }
      });

      const writes = [];
      docBuilders.forEach(({ documentId, chunkDoc }) => {
        if (existingMap.has(documentId)) return;
        writes.push({ ref: chunkCollection.doc(documentId), data: chunkDoc });
      });

      for (let i = 0; i < writes.length; i += 400) {
        const batch = db.batch();
        writes.slice(i, i + 400).forEach(({ ref, data }) => {
          batch.set(ref, data, { merge: false });
        });
        await batch.commit();
      }

      await docRef.update({
        status: 'chunked',
        'chunkPrep.status': 'done',
        'chunkPrep.completedAt': admin.firestore.FieldValue.serverTimestamp(),
        'chunkPrep.chunkCount': kept.length,
        'chunkPrep.droppedCount': dropped.length,
        'chunkPrep.totalChunks': chunks.length,
        'chunkPrep.sizeBytes': sizeBytes,
        'chunkPrep.sha256': pdfHash,
        'chunkPrep.sourceId': sourceId,
        'chunkPrep.pageCount': pageCount,
        'chunkPrep.chunkSize': config.chunkSize,
        'chunkPrep.chunkOverlap': config.chunkOverlap,
        'chunkPrep.pagesWithText': perPage.filter((text) => text).length,
        'chunkPrep.chunksWritten': writes.length,
        'chunkPrep.chunksExisting': kept.length - writes.length,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const errorText =
        error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
      console.error('chunkPrepFromPdf failed', { docPath, error: errorText });

      const waitingForUpload = errorText.includes(
        'PDF not found or empty after waiting for upload',
      );

      const updatePayload = waitingForUpload
        ? {
            status: 'waiting-upload',
            'chunkPrep.status': 'waiting-upload',
            'chunkPrep.waitingSince': admin.firestore.FieldValue.serverTimestamp(),
            'chunkPrep.errorMessage': errorText,
            'chunkPrep.retries': admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: errorText,
          }
        : {
            status: 'error',
            'chunkPrep.status': 'error',
            'chunkPrep.errorAt': admin.firestore.FieldValue.serverTimestamp(),
            'chunkPrep.errorMessage': errorText,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastError: errorText,
          };

      await docRef.update(updatePayload);

      throw error;
    }
  },
);

export default chunkPrepFromPdf;

