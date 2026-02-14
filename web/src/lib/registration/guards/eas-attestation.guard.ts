import type { RegistrationGuard } from './index';

/**
 * EAS Attestation Guard (stub)
 *
 * 将来的にはEASコントラクトのgetAttestation()を呼び、
 * 特定のスキーマUIDに対するattestationを持つユーザーのみ
 * 登録可能にする。
 *
 * 実装時に必要:
 * - EAS_CONTRACT_ADDRESS (env)
 * - REGISTRATION_SCHEMA_UID (env)
 * - viem readContract でアテステーション存在確認
 */
export function createEasAttestationGuard(
  _walletAddress: string | undefined
): RegistrationGuard {
  return async () => ({
    id: 'eas-attestation',
    name: 'EAS Attestation',
    allowed: true,
    // 将来: allowed: false, reason: 'Required attestation not found'
  });
}
