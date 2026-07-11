import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/budget-settings');

import { enforceDailyBudget, enforceDelegation, verifyWalletAddress } from '../route-guards';
import { getSpentToday } from '@/lib/db/budget-settings';

const WALLET = '0xAbCdEf0000000000000000000000000000000001';

describe('verifyWalletAddress', () => {
  it('accepts a case-insensitive match', () => {
    expect(verifyWalletAddress(WALLET.toLowerCase(), WALLET.toUpperCase())).toBeNull();
  });

  it('rejects a mismatch with 403', () => {
    const res = verifyWalletAddress(WALLET, '0x0000000000000000000000000000000000000002');
    expect(res?.status).toBe(403);
  });

  it('rejects when the user has no wallet address', () => {
    expect(verifyWalletAddress(WALLET, null)?.status).toBe(403);
  });
});

describe('enforceDelegation', () => {
  it('passes when delegated', () => {
    expect(enforceDelegation(true)).toBeNull();
  });

  it('rejects with 403 when not delegated', () => {
    expect(enforceDelegation(false)?.status).toBe(403);
  });
});

describe('enforceDailyBudget', () => {
  const budget = { dailyLimit: 100, autoApproveThreshold: 1 };

  it('passes when under the limit', async () => {
    vi.mocked(getSpentToday).mockResolvedValue(50);
    expect(await enforceDailyBudget('user-1', budget)).toBeNull();
  });

  it('rejects with 402 when the limit is reached', async () => {
    vi.mocked(getSpentToday).mockResolvedValue(100);
    expect((await enforceDailyBudget('user-1', budget))?.status).toBe(402);
  });
});
