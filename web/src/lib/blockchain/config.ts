/**
 * Blockchain Configuration (Web)
 *
 * Base Sepoliaネットワークとスマートコントラクトの設定
 * 共通設定は @agent-marketplace/shared から取得
 */

import { base, baseSepolia } from 'viem/chains';

// 共通設定をインポート
export {
  CONTRACT_ADDRESSES,
  RPC_URL,
  USDC_DECIMALS,
  USDC_UNIT,
  parseUSDC,
  formatUSDCAmount,
} from '@agent-marketplace/shared';

// 環境に応じたチェーン選択（Web固有）
export const CHAIN = (() => {
  const v = (process.env.NEXT_PUBLIC_CHAIN || '').toLowerCase();
  // 例:
  // - base-sepolia
  // - base
  // - mainnet
  if (v === 'base') return base;
  if (v === 'mainnet') return base; // このプロジェクトの "mainnet" は Base mainnet を指す想定
  return baseSepolia;
})();

// Block Explorer（Web固有）
export const BLOCK_EXPLORER_URL = CHAIN.blockExplorers?.default.url || '';

// トランザクション設定（Web固有）
export const TX_CONFIG = {
  confirmations: 1,
  timeout: 60000, // 60秒
} as const;

export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
