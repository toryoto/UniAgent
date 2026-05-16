/**
 * @module utils/logger
 * カテゴリ別・レベル別のコンソールロガー。
 * chalk によるカラーリングと構造化された JSON 詳細出力を提供する。
 */

import chalk from 'chalk';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
export type LogCategory = 'agent' | 'llm' | 'mcp' | 'logic' | 'payment' | 'http' | 'eval';

// ── Public ────────────────────────────────────────────────────────────────

/**
 * カテゴリとレベルを指定してログを出力する。
 *
 * @param category - ログカテゴリ（agent, payment, eval など）
 * @param level - ログレベル（info, success, warn, error, debug）
 * @param message - ログメッセージ
 * @param details - 追加の構造化データ（任意）
 */
export function log(
  category: LogCategory,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  const timestamp = formatTimestamp();
  const icon = levelColors[level](levelIcons[level]);
  const cat = categoryColors[category](`[${category.toUpperCase()}]`);
  const msg = levelColors[level](message);

  console.log(`${timestamp} ${icon} ${cat} ${msg}`);

  if (details && Object.keys(details).length > 0) {
    const detailStr = JSON.stringify(details, null, 2)
      .split('\n')
      .map((line) => `    ${chalk.gray(line)}`)
      .join('\n');
    console.log(detailStr);
  }
}

/**
 * カテゴリ別のロガーオブジェクト。
 * `logger.payment.success(...)` のように使用する。
 */
export const logger = {
  agent: {
    info: (msg: string, details?: Record<string, unknown>) => log('agent', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('agent', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) => log('agent', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('agent', 'error', msg, details),
  },
  llm: {
    info: (msg: string, details?: Record<string, unknown>) => log('llm', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('llm', 'success', msg, details),
  },
  mcp: {
    info: (msg: string, details?: Record<string, unknown>) => log('mcp', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('mcp', 'success', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('mcp', 'error', msg, details),
  },
  logic: {
    info: (msg: string, details?: Record<string, unknown>) => log('logic', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('logic', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) => log('logic', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('logic', 'error', msg, details),
  },
  payment: {
    info: (msg: string, details?: Record<string, unknown>) => log('payment', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('payment', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) => log('payment', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('payment', 'error', msg, details),
  },
  http: {
    info: (msg: string, details?: Record<string, unknown>) => log('http', 'info', msg, details),
  },
  eval: {
    info: (msg: string, details?: Record<string, unknown>) => log('eval', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) => log('eval', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) => log('eval', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) => log('eval', 'error', msg, details),
  },
};

/**
 * 番号付きステップログを出力する。
 *
 * @param step - ステップ番号
 * @param category - ログカテゴリ
 * @param message - ステップの説明
 */
export function logStep(step: number, category: LogCategory, message: string): void {
  const timestamp = formatTimestamp();
  const stepNum = chalk.bold.white(`[Step ${step}]`);
  const cat = categoryColors[category](`[${category.toUpperCase()}]`);
  console.log(`${timestamp} ${stepNum} ${cat} ${message}`);
}

/**
 * 視覚的なセパレータ行を出力する。
 *
 * @param title - セパレータのタイトル（省略時は線のみ）
 */
export function logSeparator(title?: string): void {
  const line = '─'.repeat(60);
  if (title) {
    console.log(chalk.gray(`\n${'─'.repeat(20)} ${title} ${'─'.repeat(20)}\n`));
  } else {
    console.log(chalk.gray(line));
  }
}

// ── Private ───────────────────────────────────────────────────────────────

const categoryColors: Record<LogCategory, (text: string) => string> = {
  agent: chalk.blue,
  llm: chalk.magenta,
  mcp: chalk.cyan,
  logic: chalk.yellow,
  payment: chalk.green,
  http: chalk.gray,
  eval: chalk.blueBright,
};

const levelIcons: Record<LogLevel, string> = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '✗',
  debug: '⋯',
};

const levelColors: Record<LogLevel, (text: string) => string> = {
  info: chalk.blue,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
};

function formatTimestamp(): string {
  return chalk.gray(new Date().toISOString().substring(11, 23));
}
