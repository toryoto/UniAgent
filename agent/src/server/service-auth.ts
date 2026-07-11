/**
 * @module server/service-auth
 * Agent Service (:3002) の service-to-service 認証。
 * web からの Bearer トークンを検証し、Web をバイパスした直接呼び出しを防ぐ。
 * HTTP 配線（index.ts）と認証ロジックを分離するためのモジュール。
 */

import { timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Authorization ヘッダーのトークンが設定値と一致するか判定する。
 *
 * - `configuredToken` 未設定時: production では拒否（fail-closed）、
 *   非 production では素通り。
 * - `Bearer ` プレフィックスを剥がして定数時間比較する。
 *
 * @param authorizationHeader - リクエストの Authorization ヘッダー（信用しない）
 * @param configuredToken - サーバー設定の共有トークン（`AGENT_SERVICE_TOKEN`）
 * @param isProduction - production 環境かどうか
 */
export function isServiceTokenValid(
  authorizationHeader: string | undefined,
  configuredToken: string | undefined,
  isProduction: boolean,
): boolean {
  if (!configuredToken) {
    return !isProduction;
  }
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return false;
  }
  const provided = authorizationHeader.slice('Bearer '.length);
  return safeEqual(provided, configuredToken);
}

/**
 * service token を検証する Express ミドルウェア。
 * `/health` は無条件に通過させ、検証失敗時は 401 を返す。
 */
export function verifyServiceToken(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health') {
    next();
    return;
  }

  const valid = isServiceTokenValid(
    req.header('authorization'),
    process.env.AGENT_SERVICE_TOKEN,
    process.env.NODE_ENV === 'production',
  );

  if (!valid) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

/** タイミング攻撃を避けて2つの文字列を定数時間比較する */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
