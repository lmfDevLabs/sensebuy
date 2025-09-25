import admin from 'firebase-admin';

import { db, storage } from '../../firebase/admin.js';

const PDF_CONTENT_TYPE = 'application/pdf';
const UPLOAD_URL_TTL_MINUTES = 15;

const sanitizeFileName = (name) => {
  const fallback = 'document.pdf';
  if (!name || typeof name !== 'string') return fallback;

  const trimmed = name.trim().toLowerCase();
  const safe = trimmed.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-');
  if (!safe) return fallback;
  return safe.endsWith('.pdf') ? safe : `${safe}.pdf`;
};

export const createPdfUploadUrl = async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).send({ error: 'Unauthorized' });
    }

    const payload =
      req.body && typeof req.body === 'object' ? req.body : {};
    const fileName = sanitizeFileName(
      payload.fileName || payload.name || payload.originalName,
    );

    const bucket = storage.bucket();
    const bucketName = bucket.name;

    const docRef = db.collection('products-pdf').doc();
    const docId = docRef.id;
    const objectPath = `uploads/pdfs/${userId}/${docId}/${fileName}`;

    const expiresAtMs = Date.now() + UPLOAD_URL_TTL_MINUTES * 60 * 1000;
    const expiresAt = new Date(expiresAtMs);

    const [uploadUrl] = await bucket.file(objectPath).getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType: PDF_CONTENT_TYPE,
    });

    const baseDoc = {
      status: 'pre-queued',
      bucket: bucketName,
      objectPath,
      fileName,
      contentType: PDF_CONTENT_TYPE,
      userId,
      productId: payload.productId || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      uploadRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
      uploadExpiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      chunkPrep: {
        status: 'waiting',
      },
      metadata: {
        requestIp: req.headers['x-forwarded-for'] || req.ip || null,
        userAgent: req.get('user-agent') || null,
      },
    };

    await docRef.set(baseDoc, { merge: true });

    return res.status(200).send({ uploadUrl, objectPath, docId });
  } catch (error) {
    console.error('Failed to create PDF upload URL', error);
    return res.status(500).send({ error: 'Failed to create upload URL' });
  }
};

