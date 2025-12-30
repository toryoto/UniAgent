/**
 * x402 Protocol Module
 *
 * x402決済はCoinbase x402 SDKを使用:
 * - x402-next: withX402 ミドルウェア
 * - @coinbase/x402: facilitator
 *
 * このモジュールはエージェントメタデータと型定義のみを提供
 */

export * from './constants';
export * from './types';

// NOTE: verify.ts は廃止されました
// x402決済はwithX402 + facilitatorで処理してください
