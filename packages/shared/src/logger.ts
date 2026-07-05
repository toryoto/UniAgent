/**
 * @module logger
 * pino ベースの共有ロガー。全 workspace（web / agent / a2a-agents）で共通の
 * 構造化ロギング基盤を提供する。
 *
 * - 本番（NODE_ENV=production）: JSON 1 行ログ（ログ集約基盤向け）
 * - 開発: pino-pretty による色付き人間可読ログ
 * - AsyncLocalStorage の実行コンテキスト（threadId / requestId 等）を
 *   pino の mixin で全ログに自動注入する
 * - 機密フィールド（秘密鍵・トークン・Authorization ヘッダー等）は redact で自動マスク
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { pino, stdSerializers, stdTimeFunctions, type Logger } from 'pino';

export type { Logger };

// ── Log context (traceability) ────────────────────────────────────────────

/**
 * 1 リクエスト / 1 スレッド実行に紐づくログコンテキスト。
 * ここに入れた値は、その非同期実行スコープ内の全ログへ自動付与される。
 */
export interface LogContext {
  /** LangGraph の thread_id。HITL resume を跨いだ実行単位のトレースに使う */
  threadId?: string;
  /** HTTP リクエスト単位の相関 ID */
  requestId?: string;
  [key: string]: unknown;
}

const logContextStorage = new AsyncLocalStorage<LogContext>();

/**
 * ログコンテキストを設定して fn を実行する。
 * fn から派生する非同期処理（await / generator 消費を含む）内の
 * 全ログに context の内容が自動付与される。
 */
export function runWithLogContext<T>(context: LogContext, fn: () => T): T {
  return logContextStorage.run({ ...context }, fn);
}

/**
 * 現在のログコンテキストへ値を追記する（例: リクエスト受付後に確定した threadId）。
 * runWithLogContext のスコープ外で呼ばれた場合は何もしない。
 */
export function bindLogContext(patch: LogContext): void {
  const store = logContextStorage.getStore();
  if (store) Object.assign(store, patch);
}

/** 現在のログコンテキストを返す（スコープ外では undefined）。 */
export function getLogContext(): Readonly<LogContext> | undefined {
  return logContextStorage.getStore();
}

// ── Root logger ───────────────────────────────────────────────────────────

const LEVELS = new Set(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);

function resolveLevel(): string {
  const env = (process.env['LOG_LEVEL'] ?? '').toLowerCase();
  return LEVELS.has(env) ? env : 'info';
}

const isProduction = process.env.NODE_ENV === 'production';

/**
 * 機密情報のマスク対象。ログオブジェクトの浅い階層と 1 段ネストをカバーする。
 * ここに漏れる深いネストは呼び出し側でログに含めないこと（セキュリティ境界）。
 */
const REDACT_PATHS = [
  'privateKey',
  '*.privateKey',
  'apiKey',
  '*.apiKey',
  'secret',
  '*.secret',
  'password',
  '*.password',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'headers.authorization',
  'headers.cookie',
];

const rootLogger = pino({
  level: resolveLevel(),
  base: undefined,
  timestamp: stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  serializers: { err: stdSerializers.err },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  mixin: () => ({ ...logContextStorage.getStore() }),
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss.l',
            ignore: 'component',
            messageFormat: '\x1b[36m[{component}]\x1b[0m {msg}',
          },
        },
      }),
});

/**
 * コンポーネント別の子ロガーを作成する。
 * 使い方: `const log = createLogger('payment'); log.info({ txHash }, 'settled');`
 */
export function createLogger(component: string): Logger {
  return rootLogger.child({ component });
}
