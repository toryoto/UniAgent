/**
 * Payment Utilities
 *
 * x402決済関連のユーティリティ関数
 */

import { x402Client, x402HTTPClient } from '@x402/core/client';
import { formatUSDCAmount } from '@agent-marketplace/shared';
import type { PaymentRequiredData } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * PAYMENT-REQUIREDヘッダーをデコード
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
 * 6 decimalsからUSDCに変換（ログ用）
 */
export function convertAmountToUSDC(amount: string): string {
  const value = BigInt(amount);
  return formatUSDCAmount(value).toFixed(6);
}

/**
 * PAYMENT-RESPONSEヘッダーから決済情報を取得
 */
export function getPaymentSettleResponse(
  getHeader: (name: string) => string | null
): ReturnType<typeof x402HTTPClient.prototype.getPaymentSettleResponse> | null {
  const client = new x402Client();
  const httpClient = new x402HTTPClient(client);
  return httpClient.getPaymentSettleResponse(getHeader);
}

/**
 * 決済金額とmaxPriceを比較
 */
export function validatePaymentAmount(
  paymentAmount: string | undefined,
  maxPrice: number
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
