import { db } from '../../firebase/admin.js';
import admin from 'firebase-admin';
import { createChatMessage } from '../../utilities/firestore.js';
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();
const TOPIC = 'chat-messages';
const ALLOWED_SEARCH_MODES = new Set(['algolia', 'semantic']);

/**
 * HTTP endpoint to process a chat message and enqueue further processing.
 * Expects auth middleware to populate req.user.{uid,type}.
 * Body: { userQuery: string, sessionId?: string, client_msg_id?: string, search_mode?: 'algolia'|'semantic' }
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userType = req.user?.type;
    if (userType !== 'buyer') {
      return res.status(403).json({ error: 'Forbidden: only buyers can send messages' });
    }

    const { userQuery, sessionId: providedSessionId, client_msg_id, search_mode } = req.body || {};
    if (!userQuery) {
      return res.status(400).json({ error: 'userQuery required' });
    }

    // Ensure session exists
    let sessionId = providedSessionId;
    const sessionsRef = db.collection('chats').doc(userId).collection('sessions');
    const sessionRef = sessionId ? sessionsRef.doc(sessionId) : sessionsRef.doc();
    if (!sessionId) {
      sessionId = sessionRef.id;
      await sessionRef.set({
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
        message_count: 0,
      });
    } else {
      await sessionRef.set(
        { last_message_at: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    // Store user message
    const docPath = await createChatMessage({
      userId,
      sessionId,
      role: 'user',
      content: userQuery,
    });

    await sessionRef.set(
      {
        message_count: admin.firestore.FieldValue.increment(1),
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Simple routing by parameter
    const modeNormalized = (search_mode || '').toLowerCase();
    const mode = ALLOWED_SEARCH_MODES.has(modeNormalized) ? modeNormalized : 'algolia';

    const payload = { docPath, sessionId, userId, client_msg_id, search_mode: mode };
    await pubsub.topic(TOPIC).publishMessage({ json: payload });

    return res.status(202).json({ sessionId, search_mode: mode });
  } catch (err) {
    console.error('sendMessage error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

export { sendMessage };
