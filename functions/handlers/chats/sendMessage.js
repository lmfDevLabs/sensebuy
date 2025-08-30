import { db } from '../../firebase/admin.js';
import admin from 'firebase-admin';
import { createChatMessage } from '../../utilities/firestore.js';
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();
const TOPIC = 'chat-messages';

/**
 * HTTP endpoint to process a chat message and enqueue further processing.
 * Expects auth middleware to populate req.user.uid.
 * Body: { userQuery: string, sessionId?: string, client_msg_id?: string }
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user && req.user.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userQuery, sessionId: providedSessionId, client_msg_id } = req.body || {};
    if (!userQuery) {
      res.status(400).json({ error: 'userQuery required' });
      return;
    }

    // Ensure session exists
    let sessionId = providedSessionId;
    const sessionRef = db.collection('chats').doc(userId).collection('sessions').doc(sessionId || undefined);
    if (!sessionId) {
      sessionId = sessionRef.id;
      await sessionRef.set({
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
        message_count: 0,
      });
    } else {
      await sessionRef.set({
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Store user message and obtain document path
    const docPath = await createChatMessage({ userId, sessionId, role: 'user', content: userQuery });

    await sessionRef.set({
      message_count: admin.firestore.FieldValue.increment(1),
      last_message_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const payload = { docPath, sessionId, userId, client_msg_id };
    await pubsub.topic(TOPIC).publishMessage({ json: payload });

    res.status(202).json({ sessionId });
  } catch (err) {
    console.error('sendMessage error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { sendMessage };
