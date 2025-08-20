import { db } from '../../firebase/admin.js';
import admin from 'firebase-admin';
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();
const TOPIC = 'chat-messages';

/**
 * HTTP endpoint to enqueue a chat message.
 * Expects auth middleware to populate req.user.uid.
 * Body: { userQuery: string, sessionId?: string, clientMsgId?: string }
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user && req.user.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userQuery, sessionId: providedSessionId, clientMsgId } = req.body || {};
    if (!userQuery) {
      res.status(400).json({ error: 'userQuery required' });
      return;
    }

    // Ensure session exists
    let sessionId = providedSessionId;
    let sessionRef;
    if (!sessionId) {
      sessionRef = db.collection('chats').doc(userId).collection('sessions').doc();
      sessionId = sessionRef.id;
      await sessionRef.set({
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
        message_count: 0,
      });
    } else {
      sessionRef = db.collection('chats').doc(userId).collection('sessions').doc(sessionId);
      await sessionRef.set({
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // Store user message
    const messageRef = await sessionRef.collection('messages').add({
      role: 'user',
      content: userQuery,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      status: 'received',
      client_msg_id: clientMsgId || null,
    });

    const payload = {
      docPath: messageRef.path,
      userId,
      sessionId,
      messageId: messageRef.id,
      client_msg_id: clientMsgId || null,
    };

    await pubsub.topic(TOPIC).publishMessage({ json: payload });

    await sessionRef.set({
      message_count: admin.firestore.FieldValue.increment(1),
    }, { merge: true });

    res.json({ sessionId, messageId: messageRef.id });
  } catch (err) {
    console.error('sendMessage error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { sendMessage };
