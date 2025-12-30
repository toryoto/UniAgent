/**
 * x402 Payment Verification
 *
 * EIP-3009署名検証とモック決済実行
 */

import { verifyTypedData } from 'viem';
import {
  USDC_SEPOLIA_ADDRESS,
  SEPOLIA_NETWORK_ID,
  EIP3009_DOMAIN,
  EIP3009_TYPES,
} from './constants';
import type {
  X402PaymentHeader,
  PaymentVerificationResult,
  PaymentExecutionResult,
} from './types';

/**
 * X-PAYMENT ヘッダーをデコード
 */
export function decodePaymentHeader(paymentHeaderBase64: string): X402PaymentHeader {
  const decoded = Buffer.from(paymentHeaderBase64, 'base64').toString('utf-8');
  return JSON.parse(decoded) as X402PaymentHeader;
}

/**
 * x402 v2 決済を検証
 *
 * @param paymentHeaderBase64 - Base64エンコードされたX-PAYMENTヘッダー
 * @param expectedReceiver - 期待する受取アドレス
 * @param expectedAmount - 期待する金額（USDC base units）
 * @returns 検証結果
 */
export async function verifyX402Payment(
  paymentHeaderBase64: string,
  expectedReceiver: string,
  expectedAmount: string
): Promise<PaymentVerificationResult> {
  try {
    // 1. Base64デコード
    const payment = decodePaymentHeader(paymentHeaderBase64);

    // 2. バージョンチェック（v2）
    if (payment.version !== '2') {
      return {
        success: false,
        error: `Unsupported x402 version: ${payment.version}`,
      };
    }

    // 3. ネットワークチェック（CAIP-2）
    if (payment.network && payment.network !== SEPOLIA_NETWORK_ID) {
      return {
        success: false,
        error: `Invalid network: expected ${SEPOLIA_NETWORK_ID}, got ${payment.network}`,
      };
    }

    // 4. 基本検証（金額、受取者）
    if (payment.to.toLowerCase() !== expectedReceiver.toLowerCase()) {
      return {
        success: false,
        error: `Invalid receiver: expected ${expectedReceiver}, got ${payment.to}`,
      };
    }

    if (payment.value !== expectedAmount) {
      return {
        success: false,
        error: `Invalid amount: expected ${expectedAmount}, got ${payment.value}`,
      };
    }

    // 5. 有効期限チェック
    const now = Math.floor(Date.now() / 1000);
    if (now < payment.validAfter) {
      return {
        success: false,
        error: 'Payment not yet valid',
      };
    }
    if (now > payment.validBefore) {
      return {
        success: false,
        error: 'Payment expired',
      };
    }

    // 6. EIP-3009署名検証（viem使用）
    const isValid = await verifyTypedData({
      address: payment.from as `0x${string}`,
      domain: {
        name: EIP3009_DOMAIN.name,
        version: EIP3009_DOMAIN.version,
        chainId: EIP3009_DOMAIN.chainId,
        verifyingContract: EIP3009_DOMAIN.verifyingContract as `0x${string}`,
      },
      types: EIP3009_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: payment.from as `0x${string}`,
        to: payment.to as `0x${string}`,
        value: BigInt(payment.value),
        validAfter: BigInt(payment.validAfter),
        validBefore: BigInt(payment.validBefore),
        nonce: payment.nonce as `0x${string}`,
      },
      signature: payment.signature as `0x${string}`,
    });

    if (!isValid) {
      return {
        success: false,
        error: 'Invalid EIP-3009 signature',
      };
    }

    // PoC: nonce重複チェックはスキップ
    // 本番環境では、Vercel KV等にnonceを記録して重複使用を防止

    return {
      success: true,
      signer: payment.from,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown verification error',
    };
  }
}

/**
 * 決済実行（PoC: モック）
 *
 * 本番環境では、実際にtransferWithAuthorizationを実行
 */
export async function executePayment(
  _payment: X402PaymentHeader
): Promise<PaymentExecutionResult> {
  // PoC: 実際の決済は行わない
  // モックのtxHashを返す
  const mockTxHash = `0x${Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('')}`;

  return {
    success: true,
    txHash: mockTxHash,
  };
}
