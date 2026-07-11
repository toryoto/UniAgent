/**
 * @module lib/agent/agent-route-orchestrator
 * Agent stream / resume Route の共通オーケストレーション。
 * 認証・予算取得・Agent Service プロキシ・SSE 応答をここに集約する。
 */

import { NextRequest } from 'next/server';
import {
  encodeSseEvent,
  SSE_RESPONSE_HEADERS,
  type StreamEvent,
} from '@agent-marketplace/shared';
import { createLogger } from '@agent-marketplace/shared/logger';
import { jsonResponse } from '@/lib/api/json-response';
import { withApiLogging } from '@/lib/api/with-api-logging';
import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { getBudgetSettings, type BudgetSettingsData } from '@/lib/db/budget-settings';
import { findUserByPrivyId } from '@/lib/db/users';
import {
  checkConversationOwnership,
  resolveConversationForStream,
} from '@/lib/agent/conversation-resolver';
import { createAgentSsePersistenceTransform } from '@/lib/agent/agent-sse-persistence';
import { postAgentServiceSse } from '@/lib/agent/agent-service-client';
import { enforceDailyBudget, enforceDelegation, verifyWalletAddress } from '@/lib/agent/route-guards';
import {
  agentStreamBodySchema,
  agentResumeBodySchema,
  type AgentStreamBody,
  type AgentResumeBody,
} from '@/lib/agent/schemas';

const log = createLogger('agent-route');

type AuthenticatedContext = {
  privyUserId: string;
  userId: string;
  walletAddress: string | null;
  isDelegated: boolean;
  budget: BudgetSettingsData;
};

/** Privy 認証とユーザー・予算設定の解決 */
export async function authenticateAgentRoute(
  request: NextRequest,
): Promise<AuthenticatedContext | Response> {
  const auth = await verifyPrivyToken(request);
  if (!auth) {
    return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  }

  const budget = await getBudgetSettings(auth.privyUserId);
  if (!budget) {
    return jsonResponse({ success: false, error: 'User not found' }, 404);
  }

  const user = await findUserByPrivyId(auth.privyUserId);
  if (!user) {
    return jsonResponse({ success: false, error: 'User not found' }, 404);
  }

  return {
    privyUserId: auth.privyUserId,
    userId: user.id,
    walletAddress: user.walletAddress,
    isDelegated: user.isDelegated,
    budget,
  };
}

/** Agent Service の SSE をクライアントへプロキシする共通レスポンス構築 */
export function buildAgentSseProxyResponse(
  upstream: Response,
  options: {
    persistAssistantToConversationId: string | null;
    metaConversationId?: string | null;
    logPrefix: string;
  },
): Response {
  if (!upstream.ok || !upstream.body) {
    return upstream;
  }

  const transformStream = createAgentSsePersistenceTransform({
    persistAssistantToConversationId: options.persistAssistantToConversationId,
    metaConversationId: options.metaConversationId,
    logPrefix: options.logPrefix,
  });

  upstream.body.pipeThrough(transformStream);

  return new Response(transformStream.readable, {
    headers: SSE_RESPONSE_HEADERS,
  });
}

/** POST /api/agent/stream のユースケース本体 */
export async function handleAgentStreamRoute(
  _request: NextRequest,
  body: AgentStreamBody,
  ctx: AuthenticatedContext,
): Promise<Response> {
  const budgetError = await enforceDailyBudget(ctx.userId, ctx.budget);
  if (budgetError) return budgetError;

  const ownershipError = verifyWalletAddress(body.walletAddress, ctx.walletAddress);
  if (ownershipError) return ownershipError;

  const delegationError = enforceDelegation(ctx.isDelegated);
  if (delegationError) return delegationError;

  const resolved = await resolveConversationForStream(
    ctx.userId,
    body.conversationId,
    body.message,
  );
  if (!resolved.ok) {
    return jsonResponse(
      {
        success: false,
        error: resolved.error === 'forbidden' ? 'Forbidden' : 'Conversation not found',
      },
      conversationAccessStatus(resolved.error),
    );
  }

  log.info(
    {
      ...(body.agentId ? { agentId: body.agentId } : {}),
      conversationId: resolved.conversationId,
      historyLength: resolved.messageHistory.length,
    },
    'Forwarding to Agent Service (stream)',
  );

  const requestBody: Record<string, unknown> = {
    message: body.message,
    walletId: body.walletId,
    walletAddress: body.walletAddress,
    autoApproveThreshold: ctx.budget.autoApproveThreshold,
    // ログ相関用メタデータ（Agent Service はロジックには使わない）
    conversationId: resolved.conversationId,
  };
  if (body.agentId) requestBody.agentId = body.agentId;
  if (resolved.messageHistory.length > 0) {
    requestBody.messageHistory = resolved.messageHistory;
  }

  const upstream = await postAgentServiceSse('/api/agent/stream', requestBody);
  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text();
    log.error({ status: upstream.status, body: errorText }, 'Agent Service error');
    return jsonResponse(
      { success: false, error: `Agent Service error: ${upstream.status}` },
      upstream.status,
    );
  }

  return buildAgentSseProxyResponse(upstream, {
    persistAssistantToConversationId: resolved.conversationId,
    metaConversationId: resolved.conversationId,
    logPrefix: '[Agent Stream API]',
  });
}

/** POST /api/agent/resume のユースケース本体 */
export async function handleAgentResumeRoute(
  _request: NextRequest,
  body: AgentResumeBody,
  ctx: AuthenticatedContext,
): Promise<Response> {
  const budgetError = await enforceDailyBudget(ctx.userId, ctx.budget);
  if (budgetError) return budgetError;

  // 委託解除後の再開を防ぐため delegation を再確認する。
  const delegationError = enforceDelegation(ctx.isDelegated);
  if (delegationError) return delegationError;

  let saveConversationId: string | null = null;
  if (body.conversationId) {
    const access = await checkConversationOwnership(ctx.userId, body.conversationId);
    if (access) {
      return jsonResponse(
        {
          success: false,
          error: access === 'forbidden' ? 'Forbidden' : 'Conversation not found',
        },
        conversationAccessStatus(access),
      );
    }
    saveConversationId = body.conversationId;
  }

  log.info(
    { threadId: body.threadId, decisionsCount: body.decisions.length, conversationId: body.conversationId },
    'Forwarding to Agent Service (resume)',
  );

  const upstream = await postAgentServiceSse('/api/agent/resume', {
    threadId: body.threadId,
    decisions: body.decisions,
    autoApproveThreshold: ctx.budget.autoApproveThreshold,
    // ログ相関用メタデータ（Agent Service はロジックには使わない）
    ...(body.conversationId ? { conversationId: body.conversationId } : {}),
  });

  if (!upstream.ok || !upstream.body) {
    const errorText = await upstream.text();
    log.error({ status: upstream.status, body: errorText }, 'Agent Service error');
    return jsonResponse(
      { success: false, error: `Agent Service error: ${upstream.status}` },
      upstream.status,
    );
  }

  return buildAgentSseProxyResponse(upstream, {
    persistAssistantToConversationId: saveConversationId,
    logPrefix: '[Agent Resume API]',
  });
}

/**
 * Route 入口: stream。
 * requestId をここで発行してログコンテキストに載せる。Agent Service へは
 * agent-service-client が x-request-id ヘッダーで伝播し、web / agent の
 * ログを同一 requestId で相関できる。
 */
export async function runAgentStreamRoute(request: NextRequest): Promise<Response> {
  return withApiLogging(request, async () => {
    try {
      const authResult = await authenticateAgentRoute(request);
      if (authResult instanceof Response) return authResult;

      const raw = await request.json();
      const parsed = agentStreamBodySchema.safeParse(raw);
      if (!parsed.success) {
        return jsonResponse(
          { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
          400,
        );
      }

      return await handleAgentStreamRoute(request, parsed.data, authResult);
    } catch (error) {
      log.error({ err: error }, 'Route handler failed');
      return jsonResponse(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500,
      );
    }
  });
}

/** Route 入口: resume。requestId の扱いは stream と同じ。 */
export async function runAgentResumeRoute(request: NextRequest): Promise<Response> {
  return withApiLogging(request, async () => {
    try {
      const authResult = await authenticateAgentRoute(request);
      if (authResult instanceof Response) return authResult;

      const raw = await request.json();
      const parsed = agentResumeBodySchema.safeParse(raw);
      if (!parsed.success) {
        return jsonResponse(
          { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid request' },
          400,
        );
      }

      return await handleAgentResumeRoute(request, parsed.data, authResult);
    } catch (error) {
      log.error({ err: error }, 'Route handler failed');
      return jsonResponse(
        { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
        500,
      );
    }
  });
}

/** web プロキシが注入する meta イベントを SSE フレーム化する */
export function encodeMetaConversationEvent(conversationId: string): string {
  return encodeSseEvent({ type: 'meta', data: { conversationId } });
}

/** クライアント向けに StreamEvent エラーを SSE で返す */
export function sseErrorResponse(message: string): Response {
  const body = encodeSseEvent({ type: 'error', data: { error: message } } satisfies StreamEvent);
  return new Response(body, { headers: SSE_RESPONSE_HEADERS });
}

function conversationAccessStatus(error: 'not_found' | 'forbidden'): number {
  return error === 'not_found' ? 404 : 403;
}