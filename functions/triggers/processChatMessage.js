import { onMessagePublished } from 'firebase-functions/v2/pubsub';
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';

const processChatMessage = onMessagePublished('chat-messages', async (event) => {
  const payload = event.data.message.json || {};
  const { docPath, userId, sessionId } = payload;
  const workerId = event.id;

  const sessionRef = db.collection('chats').doc(userId).collection('sessions').doc(sessionId);
  const messageRef = db.doc(docPath);

  try {
    await db.runTransaction(async (tx) => {
      const sessionSnap = await tx.get(sessionRef);
      const lock = sessionSnap.get('lock');
      const now = Date.now();
      const leaseUntil = lock && lock.lease_until && lock.lease_until.toMillis ? lock.lease_until.toMillis() : 0;
      if (leaseUntil > now) {
        throw new Error('locked');
      }
      tx.set(sessionRef, {
        lock: {
          leased_by: workerId,
          lease_until: admin.firestore.Timestamp.fromMillis(now + 60000)
        }
      }, { merge: true });
    });

    await messageRef.update({ status: 'processing' });

    const assistantRef = sessionRef.collection('messages').doc();
    await assistantRef.set({
      role: 'assistant',
      content: 'Mensaje procesado.',
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'done'
    });

    await messageRef.update({ status: 'done' });

    await sessionRef.set({
      lock: admin.firestore.FieldValue.delete(),
      last_message_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

  } catch (err) {
    console.error('processChatMessage error', err.message);
    await messageRef.set({
      status: 'error',
      error_message: err.message
    }, { merge: true });
    throw err; // make pub/sub retry
  }
});

export default processChatMessage;
