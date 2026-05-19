/**
 * @module lib/payment/decode
 * x402 決済関連のヘッダーデコード・金額変換・検証ユーティリティ。
 * ビジネスロジックを持たない純粋な変換関数群。
 */

import { x402Client, x402HTTPClient } from '@x402/core/client';
import { formatUSDCAmount } from '@agent-marketplace/shared';
import type { PaymentRequiredData } from '../../types/index.js';
import { logger } from '@agent-marketplace/shared/logger';

/**
 * PAYMENT-REQUIRED ヘッダー（Base64 エンコード JSON）をデコードする。
 *
 * @param header - レスポンスヘッダーの生文字列（null 許容）
 * @returns デコード済みの支払い要求データ、デコード不可時は null
 */
export function decodePaymentRequiredHeader(header: string | null): PaymentRequiredData | null {
  if (!header) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(header, 'base64').toString('utf-8'));
    return decoded as PaymentRequiredData;
  } catch (e) {
    logger.payment.warn('Failed to decode PAYMENT-REQUIRED header', {
      error: e instanceof Error ? e.message : 'Unknown',
    });
    return null;
  }
}

/**
 * USDC の 6 decimals 表記を人間可読な文字列に変換する。
 *
 * @param amount - 6 decimals のトークン量（文字列）
 * @returns 小数表記の USDC 文字列（例: "0.010000"）
 */
export function convertAmountToUSDC(amount: string): string {
  const value = BigInt(amount);
  return formatUSDCAmount(value).toFixed(6);
}

/**
 * PAYMENT-RESPONSE ヘッダーから決済結果を取得する。
 *
 * @param getHeader - ヘッダー取得関数（Response.headers.get 相当）
 * @returns 決済結果オブジェクト、ヘッダーが存在しない場合は null
 */
export function getPaymentSettleResponse(
  getHeader: (name: string) => string | null,
): ReturnType<typeof x402HTTPClient.prototype.getPaymentSettleResponse> | null {
  const client = new x402Client();
  const httpClient = new x402HTTPClient(client);
  return httpClient.getPaymentSettleResponse(getHeader);
}

/**
 * 決済金額と maxPrice を比較し、予算超過を検証する。
 *
 * @param paymentAmount - 6 decimals のトークン量（文字列、undefined 許容）
 * @param maxPrice - ユーザーが許容する最大価格 (USDC)
 * @returns 検証結果。超過時は errorMessage を含む
 */
export function validatePaymentAmount(
  paymentAmount: string | undefined,
  maxPrice: number,
): { isValid: boolean; requiredAmount?: number; errorMessage?: string } {
  if (!paymentAmount) {
    return { isValid: true };
  }

  const value = BigInt(paymentAmount);
  const requiredAmount = formatUSDCAmount(value);

  if (requiredAmount > maxPrice) {
    return {
      isValid: false,
      requiredAmount,
      errorMessage: `Payment amount (${requiredAmount.toFixed(6)} USDC) exceeds maxPrice (${maxPrice} USDC).`,
    };
  }

  return { isValid: true, requiredAmount };
}
