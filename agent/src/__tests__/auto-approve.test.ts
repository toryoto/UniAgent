import { describe, expect, it } from 'vitest';
import type { HITLRequest } from 'langchain';
import { shouldAutoApprove } from '../core/auto-approve.js';
import type { StreamProcessingContext } from '../types/index.js';

function makeRequest(
  actions: Array<{ name: string; args: Record<string, unknown> }>,
): HITLRequest {
  return {
    actionRequests: actions,
    reviewConfigs: [],
  } as unknown as HITLRequest;
}

function makeCtx(overrides: Partial<StreamProcessingContext> = {}): StreamProcessingContext {
  return {
    stepCounter: 0,
    totalCost: 0,
    autoApproveThreshold: 1,
    finalResponse: '',
    ...overrides,
  };
}

describe('shouldAutoApprove', () => {
  it('閾値以内の maxPrice は自動承認する', () => {
    const request = makeRequest([
      { name: 'execute_and_evaluate_agent', args: { maxPrice: 0.5 } },
    ]);
    expect(shouldAutoApprove(request, makeCtx())).toBe(true);
  });

  it('requireUserApproval が true なら閾値以内でも承認画面を出す', () => {
    const request = makeRequest([
      {
        name: 'execute_and_evaluate_agent',
        args: { maxPrice: 0.1, requireUserApproval: true },
      },
    ]);
    expect(shouldAutoApprove(request, makeCtx())).toBe(false);
  });

  it('maxPrice が無い / 0 以下なら自動承認しない', () => {
    expect(
      shouldAutoApprove(
        makeRequest([{ name: 'execute_and_evaluate_agent', args: {} }]),
        makeCtx(),
      ),
    ).toBe(false);
    expect(
      shouldAutoApprove(
        makeRequest([{ name: 'execute_and_evaluate_agent', args: { maxPrice: 0 } }]),
        makeCtx(),
      ),
    ).toBe(false);
  });

  it('合計 maxPrice が閾値を超えたら自動承認しない', () => {
    const request = makeRequest([
      { name: 'execute_and_evaluate_agent', args: { maxPrice: 0.6 } },
      { name: 'execute_and_evaluate_agent', args: { maxPrice: 0.6 } },
    ]);
    expect(shouldAutoApprove(request, makeCtx({ autoApproveThreshold: 1 }))).toBe(false);
  });

  it('累積コストを含めて閾値を超える場合は自動承認しない（resume 後の予算穴の回帰）', () => {
    const request = makeRequest([
      { name: 'execute_and_evaluate_agent', args: { maxPrice: 0.5 } },
    ]);
    // 既に 0.8 USDC 消費済み + 0.5 の実行 → 閾値 1.0 超過
    expect(
      shouldAutoApprove(request, makeCtx({ totalCost: 0.8, autoApproveThreshold: 1 })),
    ).toBe(false);
    // 0.4 消費済み + 0.5 → 0.9 で閾値以内
    expect(
      shouldAutoApprove(request, makeCtx({ totalCost: 0.4, autoApproveThreshold: 1 })),
    ).toBe(true);
  });
});
