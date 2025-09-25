import admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { traceable } from 'langsmith/traceable';

const TOPIC = 'pdf-chunk-prep';
const pubsub = new PubSub();

const publishJob = (payload) =>
  pubsub.topic(TOPIC).publishMessage({ json: payload });

const queueChunkPrepOnProductsPdfCreate = onDocumentCreated(
  { document: 'products-pdf/{docId}', region: 'us-central1' },
  async (event) => {
    console.log('queueChunkPrepOnProductsPdfCreate');
    const snapshot = event.data;
    const data = snapshot?.data();
    if (!snapshot || !data) return;

    const bucket = data.bucket;
    const objectPath = data.objectPath;
    if (!bucket || !objectPath) {
      console.warn('queueChunkPrepOnProductsPdfCreate: missing storage info', {
        docPath: snapshot.ref.path,
      });
      return;
    }

    const docPath = snapshot.ref.path;
    const payload = {
      bucket,
      objectPath,
      docPath,
      docId: event.params.docId,
      userId: data.userId || null,
      fileName: data.fileName || null,
      contentType: data.contentType || null,
    };

    const tracedPublish = traceable(publishJob, {
      name: 'queueChunkPrepOnProductsPdfCreate',
      run_type: 'tool',
      extractInputs: (body) => body,
      extractOutputs: () => ({}),
      metadata: { docPath },
      tags: ['queue pdf chunk prep'],
    });

    try {
      await tracedPublish(payload);
      await snapshot.ref.update({
        status: 'queued',
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        'chunkPrep.status': 'queued',
        lastError: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const errorText =
        error?.message ?? (typeof error === 'string' ? error : JSON.stringify(error));
      console.error('Failed to queue chunk prep job', { docPath, error: errorText });
      await snapshot.ref.update({
        status: 'error',
        lastError: errorText,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  },
);

export default queueChunkPrepOnProductsPdfCreate;

