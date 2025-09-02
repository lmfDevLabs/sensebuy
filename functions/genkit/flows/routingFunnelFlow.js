import { z } from 'genkit';
import { ai } from '../config.js';
import { db } from '../../firebase/admin.js';
import admin from 'firebase-admin';
import { searchInAlgolia } from '../../utilities/algolia.js';
import ragChunksFlow from './ragChunksFlow.js';
import {
  defaultRouterState,
  extractBudgetFromText,
  collectSpecifiedTraits,
  assessPerceivedIntent,
} from '../../utilities/routingFunnel.js';

const routingFunnelFlow = ai.defineFlow(
  {
    name: 'routingFunnelFlow',
    inputSchema: z.object({
      userId: z.string(),
      sessionId: z.string(),
    }),
    outputSchema: z.object({
      outcome: z.enum(['needs_info', 'direct_search', 'advisory_answer']),
      intent: z.string().optional(),
      question: z.string().optional(),
      content: z.any().optional(),
    }),
  },
  async ({ userId, sessionId }) => {
  try {
    const sessionRef = db
      .collection('chats')
      .doc(userId)
      .collection('sessions')
      .doc(sessionId);

    const messagesSnap = await sessionRef
      .collection('messages')
      .orderBy('created_at', 'asc')
      .limitToLast(8)
      .get();
    const messages = messagesSnap.docs.map((d) => d.data());
    const userQuery = messages[messages.length - 1]?.content || '';

    const sessionDoc = await sessionRef.get();
    let data = sessionDoc.exists ? sessionDoc.data() : {};
    let router_state = data.router_state || defaultRouterState();
    let awaiting_info = data.awaiting_info || false;
    let awaiting_info_field = data.awaiting_info_field || null;

    if (awaiting_info && awaiting_info_field) {
      if (awaiting_info_field === 'purpose') {
        router_state.advisory.purpose = userQuery.trim();
      } else if (awaiting_info_field.startsWith('budget')) {
        const b = extractBudgetFromText(userQuery);
        if (b.budget_min != null) router_state.advisory.budget_min = b.budget_min;
        if (b.budget_max != null) router_state.advisory.budget_max = b.budget_max;
      }
      awaiting_info = false;
      awaiting_info_field = null;
    }

    const traits = collectSpecifiedTraits(messages);
    router_state.direct.specified_traits = Array.from(
      new Set([...(router_state.direct.specified_traits || []), ...traits])
    );

    const intentRes = await assessPerceivedIntent(messages);
    router_state.intent = intentRes.intent;

    if (router_state.intent === 'direct_search') {
      const query = [userQuery, ...(router_state.direct.specified_traits || [])]
        .join(' ')
        .trim();
      const filters = router_state.direct.hard_filters || {};
      const content = await searchInAlgolia(query, filters);
      await sessionRef.set(
        {
          router_state,
          awaiting_info,
          awaiting_info_field,
          last_message_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { outcome: 'direct_search', content };
    }

    const missing = [];
    if (!router_state.advisory.purpose) missing.push('purpose');
    if (
      router_state.advisory.budget_min == null &&
      router_state.advisory.budget_max == null
    ) {
      missing.push('budget_min');
      missing.push('budget_max');
    }
    router_state.missing = missing;

    if (missing.length) {
      const nextField = missing[0];
      const question =
        nextField === 'purpose'
          ? '¿Para qué lo necesitas principalmente? (por ejemplo: ciudad diaria, familia, trabajo, viajes largos, off-road)'
          : '¿Cuál es tu presupuesto aproximado? (puede ser un rango en COP)';
      awaiting_info = true;
      awaiting_info_field = nextField;
      await sessionRef.set(
        {
          router_state,
          awaiting_info,
          awaiting_info_field,
          last_message_at: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return { outcome: 'needs_info', intent: 'advisory', question };
    }

    const {
      purpose,
      constraints,
      brand_pref,
      category_hint,
      budget_min,
      budget_max,
    } = router_state.advisory;
    const parts = [];
    if (purpose) parts.push(purpose);
    if (constraints && constraints.length) parts.push(constraints.join(', '));
    if (brand_pref) parts.push(`marca ${brand_pref}`);
    if (category_hint) parts.push(category_hint);
    if (budget_min != null || budget_max != null) {
      const b = [];
      if (budget_min != null) b.push(`desde ${budget_min}`);
      if (budget_max != null) b.push(`hasta ${budget_max}`);
      parts.push(`presupuesto ${b.join(' ')}`.trim());
    }
    const semanticQuery = parts.join(', ');

    const ragResp = await ragChunksFlow({
      query: semanticQuery,
      scope: 'products',
      timebox: null,
      strict_citation: false,
    });

    await sessionRef.set(
      {
        router_state,
        awaiting_info,
        awaiting_info_field,
        last_message_at: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    if (!ragResp || !ragResp.answer) {
      return {
        outcome: 'needs_info',
        intent: 'advisory',
        question:
          'No encontré contexto suficiente. ¿Quieres ajustar el propósito de uso o el rango de presupuesto?',
      };
    }

    return { outcome: 'advisory_answer', content: ragResp.answer };
  } catch (error) {
    console.error('routingFunnelFlow error', error);
    throw error;
  }
});

export default routingFunnelFlow;

