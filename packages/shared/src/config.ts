/**
 * Blockchain Configuration (Shared)
 */

export const CONTRACT_ADDRESSES = {
  AGENT_IDENTITY_REGISTRY:
    process.env.AGENT_IDENTITY_REGISTRY_ADDRESS ||
    process.env.NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY_ADDRESS ||
    '',
  USDC: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
} as const;

export const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';

export const PINATA_GATEWAY_URL =
  process.env.PINATA_GATEWAY_URL || process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || '';

// USDC設定（6 decimals）
export const USDC_DECIMALS = 6;
export const USDC_UNIT = 1_000_000; // 1 USDC = 1,000,000 units

/**
 * USDCの金額をwei単位に変換
 */
export function parseUSDC(amount: number): bigint {
  return BigInt(Math.floor(amount * USDC_UNIT));
}

/**
 * wei単位のUSDCを数値に変換
 */
export function formatUSDCAmount(amount: bigint): number {
  return Number(amount) / USDC_UNIT;
}
