import type { RegistrationGuard } from './index';

/**
 * Staking Guard (stub)
 *
 * 将来的にはStakingコントラクトのbalanceOf()を呼び、
 * 最低ステーキング量を満たすユーザーのみ登録可能にする。
 *
 * 実装時に必要:
 * - STAKING_CONTRACT_ADDRESS (env)
 * - MIN_STAKE_AMOUNT (env)
 * - viem readContract でステーキング残高確認
 */
export function createStakingGuard(
  _walletAddress: string | undefined
): RegistrationGuard {
  return async () => ({
    id: 'staking',
    name: 'Staking Requirement',
    allowed: true,
    // 将来: allowed: false, reason: 'Minimum stake of X USDC required'
  });
}
