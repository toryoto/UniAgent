/**
 * x402 Payment Verification
 *
 * NOTE: x402決済の検証・実行はCoinbase x402 SDK (withX402, facilitator) が処理するため、
 * このファイルのカスタム実装は不要になりました。
 *
 * x402-next の withX402 ミドルウェアが以下を自動的に処理します：
 * - HTTP 402 Payment Required レスポンスの生成
 * - X-PAYMENT ヘッダーの検証
 * - Facilitator経由での決済処理
 * - X-PAYMENT-RESPONSE ヘッダーの生成
 *
 * 使用方法:
 * ```typescript
 * import { withX402 } from 'x402-next';
 * import { facilitator } from '@coinbase/x402';
 *
 * export const POST = withX402(
 *   handler,
 *   receiverAddress,
 *   { price: "$0.01", network: "base-sepolia", config: { description: "..." } },
 *   facilitator
 * );
 * ```
 *
 * 参考:
 * - https://docs.cdp.coinbase.com/x402/quickstart-for-sellers
 * - https://www.npmjs.com/package/x402-next
 * - https://www.npmjs.com/package/@coinbase/x402
 */

// このファイルは後方互換性のために残しています
// 新しい実装では x402-next と @coinbase/x402 を使用してください

export {};
