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
  hotel: '15000', // 0.015 USDC
  tourism: '20000', // 0.02 USDC
} as const;

// Agent IDs (deterministic hashes)
export const AGENT_IDS = {
  flight: '0x0bddd164b1ba44c2b7bd2960cce576de2de93bd1da0b5621d6b8ffcffa91b75e',
  hotel: '0x70fc4e8a3b9c2d1f5e6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e',
  tourism: '0xc1de1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
} as const;
