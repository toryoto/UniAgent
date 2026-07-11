import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { authenticateAgentRoute, handleAgentStreamRoute } from '../agent-route-orchestrator';
import type { AgentStreamBody } from '../schemas';

// DB / 認証 / Agent Service を第一級のモック境界として差し替える。
// これにより、オーケストレータの実ハンドラを Prisma・Privy・Express なしで通しテストできる。
vi.mock('@/lib/auth/verifyPrivyToken');
vi.mock('@/lib/db/users');
vi.mock('@/lib/db/budget-settings');
vi.mock('@/lib/agent/conversation-resolver');
vi.mock('@/lib/agent/agent-service-client');

import { verifyPrivyToken } from '@/lib/auth/verifyPrivyToken';
import { findUserByPrivyId } from '@/lib/db/users';
import { getBudgetSettings, getSpentToday } from '@/lib/db/budget-settings';
import { resolveConversationForStream } from '@/lib/agent/conversation-resolver';
import { postAgentServiceSse } from '@/lib/agent/agent-service-client';

const WALLET = '0xAbCdEf0000000000000000000000000000000001';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getSpentToday).mockResolvedValue(0);
  vi.mocked(resolveConversationForStream).mockResolvedValue({
    ok: true,
    conversationId: 'conv-1',
    messageHistory: [],
  });
  // 転送到達の確認用。body なしレスポンスで下流の永続化 transform を回避する。
  vi.mocked(postAgentServiceSse).mockResolvedValue(new Response(null, { status: 502 }));
});

describe('authenticateAgentRoute', () => {
  const request = {} as NextRequest;

  it('returns 401 when the token is invalid', async () => {
    vi.mocked(verifyPrivyToken).mockResolvedValue(null);
    const result = await authenticateAgentRoute(request);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });

  it('returns 404 when the user is not found', async () => {
    vi.mocked(verifyPrivyToken).mockResolvedValue({ privyUserId: 'privy-1' });
    vi.mocked(getBudgetSettings).mockResolvedValue({ dailyLimit: 100, autoApproveThreshold: 1 });
    vi.mocked(findUserByPrivyId).mockResolvedValue(null);
    const result = await authenticateAgentRoute(request);
    expect((result as Response).status).toBe(404);
  });

  it('loads walletAddress and isDelegated into the context', async () => {
    vi.mocked(verifyPrivyToken).mockResolvedValue({ privyUserId: 'privy-1' });
    vi.mocked(getBudgetSettings).mockResolvedValue({ dailyLimit: 100, autoApproveThreshold: 1 });
    vi.mocked(findUserByPrivyId).mockResolvedValue({
      id: 'user-1',
      walletAddress: WALLET,
      isDelegated: true,
    });
    const result = await authenticateAgentRoute(request);
    expect(result).not.toBeInstanceOf(Response);
    expect(result).toMatchObject({
      userId: 'user-1',
      walletAddress: WALLET,
      isDelegated: true,
    });
  });
});

describe('handleAgentStreamRoute (security boundary)', () => {
  const request = {} as NextRequest;

  it('rejects a wallet mismatch before forwarding to the Agent Service', async () => {
    const res = await handleAgentStreamRoute(
      request,
      makeBody({ walletAddress: '0x0000000000000000000000000000000000000009' }),
      makeCtx(),
    );
    expect(res.status).toBe(403);
    expect(postAgentServiceSse).not.toHaveBeenCalled();
  });

  it('rejects an undelegated wallet before forwarding', async () => {
    const res = await handleAgentStreamRoute(request, makeBody(), makeCtx({ isDelegated: false }));
    expect(res.status).toBe(403);
    expect(postAgentServiceSse).not.toHaveBeenCalled();
  });

  it('rejects when the daily budget is exhausted before forwarding', async () => {
    vi.mocked(getSpentToday).mockResolvedValue(100);
    const res = await handleAgentStreamRoute(request, makeBody(), makeCtx());
    expect(res.status).toBe(402);
    expect(postAgentServiceSse).not.toHaveBeenCalled();
  });

  it('forwards to the Agent Service once all checks pass', async () => {
    await handleAgentStreamRoute(request, makeBody(), makeCtx());
    expect(postAgentServiceSse).toHaveBeenCalledWith(
      '/api/agent/stream',
      expect.objectContaining({
        walletId: 'wallet-id-1',
        walletAddress: WALLET,
        autoApproveThreshold: 1,
      }),
    );
  });
});

// ── Private ───────────────────────────────────────────────────────────────

function makeCtx(overrides: Partial<Parameters<typeof handleAgentStreamRoute>[2]> = {}) {
  return {
    privyUserId: 'privy-1',
    userId: 'user-1',
    walletAddress: WALLET,
    isDelegated: true,
    budget: { dailyLimit: 100, autoApproveThreshold: 1 },
    ...overrides,
  };
}

function makeBody(overrides: Partial<AgentStreamBody> = {}): AgentStreamBody {
  return {
    message: 'hello',
    walletId: 'wallet-id-1',
    walletAddress: WALLET,
    ...overrides,
  };
}
