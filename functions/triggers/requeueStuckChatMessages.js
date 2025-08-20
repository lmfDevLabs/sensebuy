import { onSchedule } from 'firebase-functions/v2/scheduler';
import { PubSub } from '@google-cloud/pubsub';
import { db } from '../firebase/admin.js';
import admin from 'firebase-admin';

const pubsub = new PubSub();
const TOPIC = 'chat-messages';

const requeueStuckChatMessages = onSchedule({
  schedule: 'every 5 minutes',
  region: 'us-central1'
}, async () => {
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 5 * 60 * 1000);
  const snap = await db.collectionGroup('messages')
    .where('status', '==', 'received')
    .where('created_at', '<', cutoff)
    .limit(100)
    .get();

  const tasks = snap.docs.map((doc) => {
    const sessionRef = doc.ref.parent.parent; // sessions/{sessionId}
    const userRef = sessionRef.parent.parent; // chats/{userId}
    const payload = {
      docPath: doc.ref.path,
      userId: userRef.id,
      sessionId: sessionRef.id,
      messageId: doc.id,
      client_msg_id: doc.get('client_msg_id') || null
    };
    return pubsub.topic(TOPIC).publishMessage({ json: payload });
  });

  await Promise.all(tasks);
});

export default requeueStuckChatMessages;
