import { PrivyClient } from '@privy-io/server-auth';
import { NextRequest } from 'next/server';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!,
);

export interface AuthResult {
  privyUserId: string;
}

/**
 * Authorization ヘッダーの Bearer トークンを検証し、
 * サーバーサイドで認証済みの privyUserId を返す。
 *
 * 検証に失敗した場合は null を返す。
 */
export async function verifyPrivyToken(
  request: NextRequest,
): Promise<AuthResult | null> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  try {
    const claims = await privy.verifyAuthToken(token);
    return { privyUserId: claims.userId };
  } catch {
    return null;
  }
}
