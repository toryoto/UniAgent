/**
 * x402 Protocol Constants
 *
 * x402 v2 決済プロトコル用の定数定義
 */

// USDC Contract Address (Sepolia Testnet)
export const USDC_SEPOLIA_ADDRESS = '0x7F594ABa4E1B6e137606a8fBAb5387B90C8DEEa9';

// Network identifiers (CAIP-2 format)
export const SEPOLIA_NETWORK_ID = 'eip155:11155111';
export const BASE_SEPOLIA_NETWORK_ID = 'eip155:84532';

// Agent Receiver Address (共通)
export const AGENT_RECEIVER_ADDRESS =
  process.env.AGENT_RECEIVER_ADDRESS || '0x25b61126EED206F6470533C073DDC3B4157bb6d1';

// x402 Protocol Version
export const X402_VERSION = '2';

// EIP-3009 Domain for USDC Sepolia
export const EIP3009_DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 11155111,
  verifyingContract: USDC_SEPOLIA_ADDRESS,
};

// EIP-3009 Types for TransferWithAuthorization
export const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
};

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
