import { NextRequest, NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, parseUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { prisma, Prisma } from '@/lib/db/prisma';
import { CONTRACT_ADDRESSES, USDC_DECIMALS } from '@agent-marketplace/shared';

const FAUCET_AMOUNT = process.env.FAUCET_AMOUNT || '0.1';
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const IP_LIMIT = 3;
const WALLET_LIMIT = 1;

// ホワイトリスト（カンマ区切りで複数アドレスを指定可能）
const FAUCET_WHITELIST = (process.env.FAUCET_WHITELIST || '')
  .split(',')
  .map((addr) => addr.trim().toLowerCase())
  .filter((addr) => addr.length > 0);

// ホワイトリストに含まれているかチェック
function isWhitelisted(walletAddress: string): boolean {
  return FAUCET_WHITELIST.includes(walletAddress.toLowerCase());
}

const ERC20_ABI = [
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface AccessCheckResult {
  limited: boolean;
  reason?: 'ip' | 'wallet';
}

const checkAccessLimit = async (
  walletAddress: string,
  ipAddress: string,
  func: string
): Promise<AccessCheckResult> => {
  const now = new Date();

  return await prisma.$transaction(
    async (tx) => {
      const [ipRecord, walletRecord] = await Promise.all([
        tx.accessLimit.findUnique({
          where: {
            idx_identifier_type_feature: {
              identifier: ipAddress,
              identifierType: 'ip',
              feature: func,
            },
          },
        }),
        tx.accessLimit.findUnique({
          where: {
            idx_identifier_type_feature: {
              identifier: walletAddress,
              identifierType: 'wallet',
              feature: func,
            },
          },
        }),
      ]);

      // IPアドレスの制限チェック
      if (ipRecord) {
        const elapsed = now.getTime() - new Date(ipRecord.firstRequestAt).getTime();
        if (elapsed < RATE_LIMIT_WINDOW_MS && ipRecord.requestCount >= IP_LIMIT) {
          return { limited: true, reason: 'ip' as const };
        }
      }

      // ウォレットアドレスの制限チェック（ホワイトリストに含まれている場合はスキップ）
      const isWhitelistedWallet = isWhitelisted(walletAddress);
      if (!isWhitelistedWallet && walletRecord) {
        const elapsed = now.getTime() - new Date(walletRecord.firstRequestAt).getTime();
        if (elapsed < RATE_LIMIT_WINDOW_MS && walletRecord.requestCount >= WALLET_LIMIT) {
          return { limited: true, reason: 'wallet' as const };
        }
      }

      // 両方の制限チェックをパスした場合のみ更新処理を実行
      const updatePromises = [];

      // IPアドレスのレコード更新
      if (ipRecord) {
        const elapsed = now.getTime() - new Date(ipRecord.firstRequestAt).getTime();
        if (elapsed >= RATE_LIMIT_WINDOW_MS) {
          updatePromises.push(
            tx.accessLimit.update({
              where: { id: ipRecord.id },
              data: { firstRequestAt: now, requestCount: 1 },
            })
          );
        } else {
          updatePromises.push(
            tx.accessLimit.update({
              where: { id: ipRecord.id },
              data: { requestCount: { increment: 1 } },
            })
          );
        }
      } else {
        updatePromises.push(
          tx.accessLimit.create({
            data: {
              identifier: ipAddress,
              identifierType: 'ip',
              feature: func,
              firstRequestAt: now,
              requestCount: 1,
            },
          })
        );
      }

      // ウォレットアドレスのレコード更新（ホワイトリストに含まれている場合はスキップ）
      if (!isWhitelistedWallet) {
        if (walletRecord) {
          const elapsed = now.getTime() - new Date(walletRecord.firstRequestAt).getTime();
          if (elapsed >= RATE_LIMIT_WINDOW_MS) {
            updatePromises.push(
              tx.accessLimit.update({
                where: { id: walletRecord.id },
                data: { firstRequestAt: now, requestCount: 1 },
              })
            );
          } else {
            updatePromises.push(
              tx.accessLimit.update({
                where: { id: walletRecord.id },
                data: { requestCount: { increment: 1 } },
              })
            );
          }
        } else {
          updatePromises.push(
            tx.accessLimit.create({
              data: {
                identifier: walletAddress,
                identifierType: 'wallet',
                feature: func,
                firstRequestAt: now,
                requestCount: 1,
              },
            })
          );
        }
      }

      await Promise.all(updatePromises);

      return { limited: false };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }
  );
};

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    // 入力検証
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address format' }, { status: 400 });
    }

    const privateKey = process.env.FAUCET_ADMIN_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: 'Faucet service is not configured. Please contact administrator.' },
        { status: 503 }
      );
    }

    const formattedPrivateKey = privateKey.startsWith('0x')
      ? (privateKey as `0x${string}`)
      : (`0x${privateKey}` as `0x${string}`);

    const account = privateKeyToAccount(formattedPrivateKey);

    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    });

    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(process.env.NEXT_PUBLIC_RPC_URL),
    });

    // IPアドレスの取得
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      'unknown';

    // レート制限チェック
    const { limited, reason } = await checkAccessLimit(walletAddress, ipAddress, 'faucet');

    if (limited) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          reason:
            reason === 'ip'
              ? `IP address has reached the limit (${IP_LIMIT} requests per 24 hours)`
              : `Wallet address has already received funds (${WALLET_LIMIT} request per 24 hours)`,
        },
        { status: 429 }
      );
    }

    // USDCの量をwei単位に変換（6 decimals）
    const amount = parseUnits(FAUCET_AMOUNT, USDC_DECIMALS);

    // ERC20 transferトランザクション送信
    const hash = await walletClient.writeContract({
      address: CONTRACT_ADDRESSES.USDC as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'transfer',
      args: [walletAddress as `0x${string}`, amount],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    console.log('USDC Faucet transaction confirmed:', {
      txHash: hash,
      to: walletAddress,
      amount: FAUCET_AMOUNT,
      blockNumber: receipt.blockNumber,
    });

    return NextResponse.json({
      status: 'success',
      txHash: hash,
      amount: FAUCET_AMOUNT,
      message: `${FAUCET_AMOUNT} USDC has been sent to your wallet`,
    });
  } catch (error: unknown) {
    console.error('Faucet API error:', error);

    // エラーの種類に応じた処理
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : '';

    if (errorName === 'PrismaClientKnownRequestError') {
      return NextResponse.json(
        { error: 'Database error occurred. Please try again later.' },
        { status: 503 }
      );
    }

    if (
      errorMessage.includes('insufficient funds') ||
      errorMessage.includes('insufficient balance')
    ) {
      return NextResponse.json(
        { error: 'Faucet wallet has insufficient USDC balance. Please contact administrator.' },
        { status: 503 }
      );
    }

    if (errorMessage.includes('nonce')) {
      return NextResponse.json(
        { error: 'Transaction error occurred. Please try again in a moment.' },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
