/**
 * Agent Resume API Route (HITL)
 *
 * Agent Serviceの/api/agent/resumeへのSSEプロキシ
 * Human-in-the-Loopの承認/編集/拒否後にエージェント実行を再開
 */

import { NextRequest } from 'next/server';
import { createLogger } from '@agent-marketplace/shared/logger';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';

const log = createLogger('Agent Resume API');
import { getBudgetSettings } from '@/lib/db/budget-settings';
import { findConversationHistory } from '@/lib/db/conversations';
import { findUserIdByPrivyId } from '@/lib/db/users';
import { createAgentSsePersistenceTransform } from '@/lib/agent/agent-sse-persistence';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:3002';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/agent/resume
 *
 * Headers: Authorization: Bearer <privy-auth-token>
 * Body: { threadId: string, decisions: HITLDecision[], conversationId?: string }
 * Response: Server-Sent Events
 */
export async function POST(request: NextRequest) {
  log.info('Request received');

  try {
    const auth = await verifyPrivyToken(request);
    if (!auth) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const body = await request.json();
    const { threadId, decisions, conversationId } = body;

    if (!threadId || !Array.isArray(decisions)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: threadId and decisions are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const budgetSettings = await getBudgetSettings(auth.privyUserId);
    if (!budgetSettings) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const { autoApproveThreshold } = budgetSettings;

    const userId = await findUserIdByPrivyId(auth.privyUserId);
    let saveConversationId: string | null = null;
    if (conversationId && userId) {
      const owned = await findConversationHistory(conversationId, userId);
      if (owned) {
        saveConversationId = conversationId;
      }
    }

    log.info('Forwarding to Agent Service (resume)', {
      threadId,
      decisionsCount: decisions.length,
      conversationId,
    });

    const response = await fetch(`${AGENT_SERVICE_URL}/api/agent/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ threadId, decisions, autoApproveThreshold }),
      // @ts-expect-error -- Node.js undici option to disable response buffering
      duplex: 'half',
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      log.error('Agent Service error', { status: response.status, body: errorText });
      return new Response(
        JSON.stringify({ success: false, error: `Agent Service error: ${response.status}` }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const transformStream = createAgentSsePersistenceTransform({
      persistAssistantToConversationId: saveConversationId,
      logPrefix: '[Agent Resume API]',
    });

    response.body.pipeThrough(transformStream);

    return new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    log.error('Error', { error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
