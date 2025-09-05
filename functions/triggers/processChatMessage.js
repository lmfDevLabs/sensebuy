import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import { searchInAlgolia } from '../utilities/algolia.js';
import ragChunksFlow from '../genkit/flows/ragChunksFlow.js';

const LOCK_TTL_MS = 60 * 1000;
const MESSAGE_HISTORY_LIMIT = 10;

const processChatMessage = onMessagePublished('chat-messages', async (event) => {
  const payload = event.data.message.json || {};
  const { docPath, userId, sessionId, client_msg_id, search_mode } = payload;
  const workerId = event.id;

  const sessionRef = db.collection('chats').doc(userId).collection('sessions').doc(sessionId);
  const lockRef = sessionRef.collection('locks').doc('chat');
  const messageRef = db.doc(docPath);

  try {
    // Acquire lock for this session
    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const now = Date.now();
      const leaseUntil = lockSnap.exists && lockSnap.get('lease_until') && lockSnap.get('lease_until').toMillis ? lockSnap.get('lease_until').toMillis() : 0;
      if (leaseUntil > now) {
        throw new Error('locked');
      }
      tx.set(lockRef, {
        leased_by: workerId,
        lease_until: admin.firestore.Timestamp.fromMillis(now + LOCK_TTL_MS)
      });
    });

    // Idempotency check
    if (client_msg_id) {
      const dupSnap = await sessionRef.collection('messages').where('client_msg_id', '==', client_msg_id).get();
      if (!dupSnap.empty) {
        await messageRef.set({ status: 'duplicate' }, { merge: true });
        return;
      }
      await messageRef.set({ client_msg_id }, { merge: true });
    }

    await messageRef.set({ status: 'processing' }, { merge: true });

    // Retrieve last N messages
    const snap = await sessionRef.collection('messages')
      .orderBy('timestamp', 'desc')
      .limit(MESSAGE_HISTORY_LIMIT)
      .get();
    const messages = snap.docs.reverse().map((d) => ({
      role: d.get('role'),
      content: d.get('content'),
      fullRes: d.get('fullResponse') || d.get('content')
    }));

    const userQuery = messages[messages.length - 1]?.content || '';

    // Enrutamiento simple por parámetro (sin funnels ni auto-clasificación)
    const mode = (search_mode || 'algolia').toLowerCase();
    let assistantContent = '';
    if (mode === 'algolia') {
      assistantContent = await searchInAlgolia(userQuery);
      if (!assistantContent || (Array.isArray(assistantContent) && assistantContent.length === 0)) {
        assistantContent = 'No encontré resultados con coincidencia de palabras. Prueba afinando términos o usa el modo "semantic".';
      }
    } else if (mode === 'semantic') {
      const ragResp = await ragChunksFlow({ query: userQuery });
      assistantContent = ragResp?.answer || 'No encontré contexto suficiente con búsqueda semántica.';
    } else {
      // fallback defensivo
      assistantContent = 'Modo de búsqueda no reconocido. Usa "algolia" o "semantic".';
    }

    const assistantRef = sessionRef.collection('messages').doc();
    await assistantRef.set({
      role: 'assistant',
      content: assistantContent,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'done',
      meta: { search_mode: mode }
    });

    await messageRef.set({ status: 'done' }, { merge: true });

    await sessionRef.set({
      last_message_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

  } catch (err) {
    console.error('processChatMessage error', err.message);
    await messageRef.set({
      status: 'error',
      error_message: err.message
    }, { merge: true });
    throw err; // make pub/sub retry
  } finally {
    // Release lock
    await lockRef.delete().catch(() => {});
  }
});

export default processChatMessage;

