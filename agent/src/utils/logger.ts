/**
 * Logger Utility
 *
 * エージェントの実行ログを見やすく出力
 */

import chalk from 'chalk';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';
export type LogCategory = 'agent' | 'llm' | 'mcp' | 'logic' | 'payment' | 'http';

const categoryColors: Record<LogCategory, (text: string) => string> = {
  agent: chalk.blue,
  llm: chalk.magenta,
  mcp: chalk.cyan,
  logic: chalk.yellow,
  payment: chalk.green,
  http: chalk.gray,
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

export function log(
  category: LogCategory,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>
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

export const logger = {
  agent: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('agent', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) =>
      log('agent', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) =>
      log('agent', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) =>
      log('agent', 'error', msg, details),
  },
  llm: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('llm', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) =>
      log('llm', 'success', msg, details),
  },
  mcp: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('mcp', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) =>
      log('mcp', 'success', msg, details),
    error: (msg: string, details?: Record<string, unknown>) =>
      log('mcp', 'error', msg, details),
  },
  logic: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('logic', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) =>
      log('logic', 'success', msg, details),
    warn: (msg: string, details?: Record<string, unknown>) =>
      log('logic', 'warn', msg, details),
    error: (msg: string, details?: Record<string, unknown>) =>
      log('logic', 'error', msg, details),
  },
  payment: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('payment', 'info', msg, details),
    success: (msg: string, details?: Record<string, unknown>) =>
      log('payment', 'success', msg, details),
    error: (msg: string, details?: Record<string, unknown>) =>
      log('payment', 'error', msg, details),
  },
  http: {
    info: (msg: string, details?: Record<string, unknown>) =>
      log('http', 'info', msg, details),
  },
};

/**
 * ステップログ（番号付き）
 */
export function logStep(step: number, category: LogCategory, message: string): void {
  const timestamp = formatTimestamp();
  const stepNum = chalk.bold.white(`[Step ${step}]`);
  const cat = categoryColors[category](`[${category.toUpperCase()}]`);
  console.log(`${timestamp} ${stepNum} ${cat} ${message}`);
}

/**
 * セパレータ
 */
export function logSeparator(title?: string): void {
  const line = '─'.repeat(60);
  if (title) {
    console.log(chalk.gray(`\n${'─'.repeat(20)} ${title} ${'─'.repeat(20)}\n`));
  } else {
    console.log(chalk.gray(line));
  }
}
