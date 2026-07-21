/**
 * @module lib/payment/error-handlers
 * x402 決済エラーのハンドリングと人間可読なエラーメッセージの生成。
 */

import type { PaymentRequiredData } from '../../types/index.js';
import { convertAmountToUSDC, validatePaymentAmount } from './decode.js';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('payment');

/**
 * 402 Payment Required エラーを処理し、ユーザー向けのエラーメッセージを生成する。
 *
 * @param response - HTTP レスポンスオブジェクト
 * @param paymentRequiredDecoded - デコード済み PAYMENT-REQUIRED データ
 * @param maxPrice - ユーザーが許容する最大価格 (USDC)
 * @returns エラーメッセージと詳細情報
 */
export function handle402Error(
  response: Response,
  paymentRequiredDecoded: PaymentRequiredData | null,
  maxPrice: number,
): { errorMessage: string; errorDetails: Record<string, unknown> } {
  const paymentError = paymentRequiredDecoded?.error;
  const paymentAmount = paymentRequiredDecoded?.accepts?.[0]?.amount;
  const paymentNetwork = paymentRequiredDecoded?.accepts?.[0]?.network;
  const paymentAsset = paymentRequiredDecoded?.accepts?.[0]?.asset;
  const paymentPayTo = paymentRequiredDecoded?.accepts?.[0]?.payTo;

  let errorMessage = 'Payment required but automatic payment processing failed.';
  const errorDetails: Record<string, unknown> = {
    status: response.status,
    statusText: response.statusText,
    note: 'wrapFetchWithPayment should have automatically retried with PAYMENT-SIGNATURE header',
  };

  if (paymentError) {
    errorDetails.paymentError = paymentError;
    const errorInfo = getPaymentErrorMessage(paymentError, {
      paymentAmount,
      paymentNetwork,
      paymentAsset,
      paymentPayTo,
    });
    errorMessage = errorInfo.message;
    Object.assign(errorDetails, errorInfo.details);
  }

  if (paymentAmount) {
    const validation = validatePaymentAmount(paymentAmount, maxPrice);
    if (!validation.isValid && validation.errorMessage) {
      errorMessage = validation.errorMessage;
      errorDetails.requiredAmount = validation.requiredAmount;
      errorDetails.maxPrice = maxPrice;
      errorDetails.suggestion =
        'Please increase maxPrice or contact the agent provider to negotiate a lower price.';
    }
  }

  log.error(errorDetails, 'Payment required but not processed');

  return { errorMessage, errorDetails };
}

/**
 * 決済 settlement 失敗エラーを処理する。
 *
 * @param errorReason - 失敗理由の文字列
 * @param payer - 支払い者アドレス
 * @param network - ネットワーク識別子
 * @returns エラーメッセージと詳細情報
 */
export function handlePaymentSettlementError(
  errorReason: string,
  payer: string | undefined,
  network: string | undefined,
): { errorMessage: string; errorDetails: Record<string, unknown> } {
  const errorDetails: Record<string, unknown> = { errorReason, payer, network };
  let errorMessage = `Payment settlement failed: ${errorReason}`;

  if (errorReason.includes('insufficient') || errorReason.includes('balance')) {
    errorMessage =
      'Payment failed due to insufficient USDC balance. Please ensure your wallet has enough USDC.';
    errorDetails.suggestion =
      'Please add USDC to your wallet using the faucet or transfer from another wallet.';
  } else if (errorReason.includes('signature') || errorReason.includes('authorization')) {
    errorMessage = 'Payment failed due to invalid signature or authorization. Please try again.';
    errorDetails.suggestion =
      'The payment signature may be invalid or expired. A new request will be created automatically.';
  } else if (errorReason.includes('network') || errorReason.includes('chain')) {
    errorMessage =
      'Payment failed due to network mismatch. Please ensure you are using Base Sepolia.';
    errorDetails.suggestion =
      'Please check your network configuration and ensure you are connected to Base Sepolia.';
  }

  log.error(errorDetails, 'Payment settlement failed');

  return { errorMessage, errorDetails };
}

// ── Private ───────────────────────────────────────────────────────────────

function getPaymentErrorMessage(
  error: string,
  context: {
    paymentAmount?: string;
    paymentNetwork?: string;
    paymentAsset?: string;
    paymentPayTo?: string;
  },
): { message: string; details: Record<string, unknown> } {
  const { paymentAmount, paymentNetwork, paymentAsset, paymentPayTo } = context;

  switch (error) {
    case 'insufficient_funds': {
      const amountInUSDC = paymentAmount ? convertAmountToUSDC(paymentAmount) : 'unknown';
      return {
        message: `Insufficient USDC balance. Required: ${amountInUSDC} USDC (${paymentAmount} in 6 decimals). Please ensure your wallet has enough USDC on ${paymentNetwork || 'Base Sepolia'}.`,
        details: {
          requiredAmount: paymentAmount,
          requiredAmountUSDC: amountInUSDC,
          network: paymentNetwork,
          asset: paymentAsset,
          payTo: paymentPayTo,
          suggestion:
            'Please add USDC to your wallet using the faucet or transfer from another wallet.',
        },
      };
    }
    case 'invalid_signature':
      return {
        message: 'Payment signature verification failed. The signature may be invalid or expired.',
        details: {
          suggestion:
            'Please try again. If the problem persists, check your wallet delegation status.',
        },
      };
    case 'expired':
      return {
        message: 'Payment authorization has expired. Please try again.',
        details: {
          suggestion:
            'The payment authorization has expired. A new request will be created automatically.',
        },
      };
    case 'network_mismatch':
      return {
        message: `Network mismatch. Expected: ${paymentNetwork}, but payment was attempted on a different network.`,
        details: {
          expectedNetwork: paymentNetwork,
          suggestion: 'Please ensure you are using the correct network (Base Sepolia).',
        },
      };
    default:
      return {
        message: `Payment processing failed: ${error}`,
        details: {
          suggestion: 'Please check the payment details and try again.',
        },
      };
  }
}
