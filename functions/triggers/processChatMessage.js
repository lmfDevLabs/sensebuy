import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';
import routingFunnelFlow from '../genkit/flows/routingFunnelFlow.js';

const LOCK_TTL_MS = 60 * 1000;
const processChatMessage = onMessagePublished('chat-messages', async (event) => {
  const payload = event.data.message.json || {};
  const { docPath, userId, sessionId, client_msg_id } = payload;
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

    const result = await routingFunnelFlow({ userId, sessionId });

    const assistantRef = sessionRef.collection('messages').doc();
    if (result.outcome === 'needs_info') {
      await assistantRef.set({
        role: 'assistant',
        content: result.question,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        status: 'awaiting_user'
      });
    } else {
      await assistantRef.set({
        role: 'assistant',
        content: result.content,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        status: 'done'
      });
    }

    await messageRef.set({ status: 'done' }, { merge: true });

    await sessionRef.set(
      {
        last_message_at: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

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

