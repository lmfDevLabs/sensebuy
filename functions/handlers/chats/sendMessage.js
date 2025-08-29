import { db } from '../../firebase/admin.js';
import admin from 'firebase-admin';
import { getChatMessages, createChatMessage } from '../../utilities/firestore.js';
import { classifyChatSearchIntention } from '../../utilities/openAi.js';
import { searchInAlgolia } from '../../utilities/algolia.js';
import ragChunksFlow from '../../genkit/flows/ragChunksFlow.js';
import { PubSub } from '@google-cloud/pubsub';

const pubsub = new PubSub();
const TOPIC = 'chat-messages';

/**
 * HTTP endpoint to process a chat message and return an assistant response.
 * Expects auth middleware to populate req.user.uid.
 * Body: { userQuery: string, sessionId?: string }
 */
const sendMessage = async (req, res) => {
  try {
    const userId = req.user && req.user.uid;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userQuery, sessionId: providedSessionId } = req.body || {};
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

    // Store user message
    await createChatMessage({ userId, sessionId, role: 'user', content: userQuery });

    // Retrieve conversation history including current message
    const history = await getChatMessages(userId, sessionId);
    const messages = history.map(m => ({ role: m.role, content: m.content }));

    // Classify user intention
    const { fullResponse, intention } = await classifyChatSearchIntention(messages);
    let assistantContent = fullResponse;

    if (intention === 'product_search') {
      assistantContent = await searchInAlgolia(userQuery);
    } else if (intention === 'document_search') {
      const ragResponse = await ragChunksFlow({ query: userQuery });
      assistantContent = ragResponse.answer;
    }

    // Store assistant message
    await createChatMessage({ userId, sessionId, role: 'assistant', content: assistantContent });

    await sessionRef.set({
      message_count: admin.firestore.FieldValue.increment(2),
      last_message_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const payload = { userId, sessionId, userQuery, intention, answer: assistantContent };
    await pubsub.topic(TOPIC).publishMessage({ json: payload });

    res.json({ sessionId, intention, answer: assistantContent });
  } catch (err) {
    console.error('sendMessage error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export { sendMessage };
