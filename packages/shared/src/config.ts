/**
 * Blockchain Configuration (Shared)
 *
 * Base Sepolia (Chain ID: 84532) のデフォルトアドレス。
 * 再デプロイ後は環境変数で上書きする（コード変更なしで切り替え可能）。
 *
 * - サーバー / CLI: AGENT_IDENTITY_REGISTRY, AGENT_STAKING, USDC_ADDRESS
 * - Next.js クライアント: NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY, NEXT_PUBLIC_AGENT_STAKING, NEXT_PUBLIC_USDC_ADDRESS
 */

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

function contractAddrFromEnv(...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = process.env[k]?.trim();
    if (v && ADDR_RE.test(v)) return v;
  }
  return undefined;
}

const DEFAULT_CONTRACT_ADDRESSES = {
  AGENT_IDENTITY_REGISTRY: '0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92',
  AGENT_STAKING: '0xC034e56EDe7FC31579E41095A4e963D499e85d39',
  USDC: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
} as const;

export const CONTRACT_ADDRESSES = {
  AGENT_IDENTITY_REGISTRY:
    contractAddrFromEnv('AGENT_IDENTITY_REGISTRY', 'NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY') ??
    DEFAULT_CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY,
  AGENT_STAKING:
    contractAddrFromEnv('AGENT_STAKING', 'NEXT_PUBLIC_AGENT_STAKING') ??
    DEFAULT_CONTRACT_ADDRESSES.AGENT_STAKING,
  USDC:
    contractAddrFromEnv('USDC_ADDRESS', 'NEXT_PUBLIC_USDC_ADDRESS') ??
    DEFAULT_CONTRACT_ADDRESSES.USDC,
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
