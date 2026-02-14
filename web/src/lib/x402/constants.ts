/**
 * x402 Protocol Constants
 *
 * エージェントメタデータとx402設定用の定数
 *
 */

import { CONTRACT_ADDRESSES } from '@agent-marketplace/shared';

// USDC Contract Address (Base Sepolia Testnet)
// x402 SDKはBase Sepoliaをサポート
// sharedパッケージから取得
export const USDC_BASE_SEPOLIA_ADDRESS = CONTRACT_ADDRESSES.USDC;

// Network identifiers (CAIP-2 format)
export const SEPOLIA_NETWORK_ID = 'eip155:11155111';
export const BASE_SEPOLIA_NETWORK_ID = 'eip155:84532';

// x402 SDK Network name
export const X402_NETWORK = 'base-sepolia';

// Agent Receiver Address
export const AGENT_RECEIVER_ADDRESS =
  process.env.AGENT_RECEIVER_ADDRESS || '0x25b61126EED206F6470533C073DDC3B4157bb6d1';

// Agent Price Configuration (in USDC base units, 6 decimals)
export const AGENT_PRICES = {
  flight: '10000', // 0.01 USDC
  flightDemo: '10000', // 0.01 USDC (登録テスト用ダミー)
  hotel: '15000', // 0.015 USDC
  tourism: '20000', // 0.02 USDC
} as const;
