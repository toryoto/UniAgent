/**
 * Blockchain Configuration (Shared)
 *
 * Base Sepolia (Chain ID: 84532) のデプロイ済みアドレス
 */

export const CONTRACT_ADDRESSES = {
  /** AgentIdentityRegistry (ERC-8004) - Base Sepolia */
  // NOTE: Deployed address (see CLAUDE.md / contracts README)
  AGENT_IDENTITY_REGISTRY: '0x28E0346B623C80Fc425E85339310fe09B79012Cd',
  /** USDC (Base Sepolia) */
  USDC: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
} as const;

export const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || '';

/** Pinata Dedicated Gateway (web, agent, mcp共通). contractsは.envで独自管理 */
export const DEFAULT_PINATA_GATEWAY = 'chocolate-secret-cat-833.mypinata.cloud';

export const PINATA_GATEWAY_URL =
  process.env.PINATA_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL ||
  DEFAULT_PINATA_GATEWAY;

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
