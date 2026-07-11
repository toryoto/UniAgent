import { afterEach, describe, expect, it, vi } from 'vitest';
import { pino } from 'pino';
import {
  bindLogContext,
  createPinoOptions,
  getLogContext,
  runWithLogContext,
} from '../logger.js';

/** createPinoOptions を in-memory stream に流し、JSON ログを配列として捕捉する */
function createCapturingLogger() {
  const lines: Record<string, unknown>[] = [];
  const stream = {
    write(chunk: string) {
      lines.push(JSON.parse(chunk) as Record<string, unknown>);
    },
  };
  const logger = pino(createPinoOptions(), stream);
  return { logger, lines };
}

describe('ログコンテキスト (AsyncLocalStorage)', () => {
  it('runWithLogContext のスコープ内で getLogContext がコンテキストを返す', () => {
    expect(getLogContext()).toBeUndefined();
    runWithLogContext({ requestId: 'req-1' }, () => {
      expect(getLogContext()).toEqual({ requestId: 'req-1' });
    });
    expect(getLogContext()).toBeUndefined();
  });

  it('fn の戻り値をそのまま返す', () => {
    expect(runWithLogContext({}, () => 42)).toBe(42);
  });

  it('bindLogContext が現在のコンテキストへ追記する', () => {
    runWithLogContext({ requestId: 'req-1' }, () => {
      bindLogContext({ threadId: 'thread-1' });
      expect(getLogContext()).toEqual({ requestId: 'req-1', threadId: 'thread-1' });
    });
  });

  it('bindLogContext はスコープ外では no-op（throw しない）', () => {
    expect(() => bindLogContext({ threadId: 'orphan' })).not.toThrow();
    expect(getLogContext()).toBeUndefined();
  });

  it('非同期ホップをまたいでコンテキストが伝播する', async () => {
    await runWithLogContext({ requestId: 'req-async' }, async () => {
      await new Promise((r) => setTimeout(r, 1));
      bindLogContext({ threadId: 'thread-async' });
      await new Promise((r) => setTimeout(r, 1));
      expect(getLogContext()).toEqual({ requestId: 'req-async', threadId: 'thread-async' });
    });
  });

  it('並行する実行同士でコンテキストが混ざらない', async () => {
    const results = await Promise.all([
      runWithLogContext({ requestId: 'a' }, async () => {
        await new Promise((r) => setTimeout(r, 5));
        return getLogContext()?.requestId;
      }),
      runWithLogContext({ requestId: 'b' }, async () => {
        await new Promise((r) => setTimeout(r, 1));
        return getLogContext()?.requestId;
      }),
    ]);
    expect(results).toEqual(['a', 'b']);
  });

  it('呼び出し元のコンテキストオブジェクトを変異させない（コピーして保持する）', () => {
    const original = { requestId: 'req-immutable' };
    runWithLogContext(original, () => {
      bindLogContext({ threadId: 'thread-x' });
    });
    expect(original).toEqual({ requestId: 'req-immutable' });
  });
});

describe('createPinoOptions', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('mixin がコンテキストの threadId / requestId を全ログに注入する', () => {
    const { logger, lines } = createCapturingLogger();
    runWithLogContext({ requestId: 'req-9' }, () => {
      bindLogContext({ threadId: 'thread-9' });
      logger.info({ txHash: '0xabc' }, 'payment settled');
    });
    expect(lines[0]).toMatchObject({
      requestId: 'req-9',
      threadId: 'thread-9',
      txHash: '0xabc',
      msg: 'payment settled',
    });
  });

  it('スコープ外のログにはコンテキストフィールドが付かない', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info('plain');
    expect(lines[0]).not.toHaveProperty('requestId');
    expect(lines[0]).not.toHaveProperty('threadId');
  });

  it('child ロガーの component がログに含まれる', () => {
    const { logger, lines } = createCapturingLogger();
    logger.child({ component: 'payment' }).info('hello');
    expect(lines[0]).toMatchObject({ component: 'payment' });
  });

  it('level が数値ではなくラベル文字列で出力される', () => {
    const { logger, lines } = createCapturingLogger();
    logger.warn('careful');
    expect(lines[0]?.level).toBe('warn');
  });

  it('機密フィールド（privateKey / apiKey / ネスト1段）を redact する', () => {
    const { logger, lines } = createCapturingLogger();
    logger.info(
      { privateKey: '0xsecret', wallet: { apiKey: 'k', authorization: 'Bearer t' }, safe: 'ok' },
      'redaction',
    );
    expect(lines[0]).toMatchObject({
      privateKey: '[REDACTED]',
      wallet: { apiKey: '[REDACTED]', authorization: '[REDACTED]' },
      safe: 'ok',
    });
  });

  it('err キーの Error を stack 付きで構造化する', () => {
    const { logger, lines } = createCapturingLogger();
    logger.error({ err: new Error('boom') }, 'failed');
    const err = lines[0]?.err as Record<string, unknown>;
    expect(err.message).toBe('boom');
    expect(String(err.stack)).toContain('Error: boom');
  });

  it('LOG_LEVEL が有効値ならそれを、不正値なら info を使う', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    expect(createPinoOptions().level).toBe('warn');

    vi.stubEnv('LOG_LEVEL', 'success');
    expect(createPinoOptions().level).toBe('info');

    vi.stubEnv('LOG_LEVEL', '');
    expect(createPinoOptions().level).toBe('info');
  });

  it('LOG_LEVEL に従い閾値未満のログを出力しない', () => {
    vi.stubEnv('LOG_LEVEL', 'warn');
    const { logger, lines } = createCapturingLogger();
    logger.info('suppressed');
    logger.warn('emitted');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.msg).toBe('emitted');
  });
});
