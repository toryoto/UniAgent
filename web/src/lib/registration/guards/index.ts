/**
 * Registration Guard System
 *
 * 拡張可能なGuardパターン: EAS、Staking等の前提条件チェックを
 * guardファイル追加 + 配列登録のみで拡張可能
 */

export interface RegistrationGuardResult {
  id: string;
  name: string;
  allowed: boolean;
  reason?: string;
  actionLabel?: string;
  actionHref?: string;
}

export type RegistrationGuard = () => Promise<RegistrationGuardResult>;

export async function evaluateGuards(
  guards: RegistrationGuard[]
): Promise<RegistrationGuardResult[]> {
  return Promise.all(guards.map((g) => g()));
}
