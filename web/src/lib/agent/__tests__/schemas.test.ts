import { describe, expect, it } from 'vitest';
import { agentStreamBodySchema } from '../schemas';

describe('agentStreamBodySchema', () => {
  const valid = {
    message: 'hello',
    walletId: 'wallet-id-1',
    walletAddress: '0x0000000000000000000000000000000000000001',
  };

  it('accepts a minimal valid body', () => {
    expect(agentStreamBodySchema.safeParse(valid).success).toBe(true);
  });

  it('does not expose a client-controlled autoApproveThreshold', () => {
    const parsed = agentStreamBodySchema.parse({ ...valid, autoApproveThreshold: 9999 });
    // セキュリティ境界値はサーバーが DB から読む。クライアント値は素通りさせない。
    expect(parsed).not.toHaveProperty('autoApproveThreshold');
  });

  it('does not accept a client-supplied isDelegated field', () => {
    const parsed = agentStreamBodySchema.parse({ ...valid, isDelegated: true });
    expect(parsed).not.toHaveProperty('isDelegated');
  });

  it('rejects a body missing walletAddress', () => {
    const { walletAddress: _omit, ...rest } = valid;
    expect(agentStreamBodySchema.safeParse(rest).success).toBe(false);
  });
});
