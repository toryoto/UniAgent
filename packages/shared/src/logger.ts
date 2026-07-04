import chalk from 'chalk';

type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

interface ComponentLogger {
  info(msg: string, details?: Record<string, unknown>): void;
  success(msg: string, details?: Record<string, unknown>): void;
  warn(msg: string, details?: Record<string, unknown>): void;
  error(msg: string, details?: Record<string, unknown>): void;
  debug(msg: string, details?: Record<string, unknown>): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  success: 2,
  warn: 3,
  error: 4,
};

function getMinLevel(): LogLevel {
  const env = (process.env['LOG_LEVEL'] ?? '').toLowerCase();
  if (env in LEVEL_ORDER) return env as LogLevel;
  return 'info';
}

const COLOR_PALETTE: Array<(t: string) => string> = [
  chalk.blue,
  chalk.magenta,
  chalk.cyan,
  chalk.yellow,
  chalk.green,
  chalk.blueBright,
  chalk.greenBright,
  chalk.yellowBright,
  chalk.cyanBright,
  chalk.magentaBright,
];

const KNOWN_COLORS: Record<string, (t: string) => string> = {
  agent: chalk.blue,
  llm: chalk.magenta,
  logic: chalk.yellow,
  payment: chalk.green,
  http: chalk.gray,
  eval: chalk.blueBright,
};

function nameToColor(name: string): (t: string) => string {
  const lower = name.toLowerCase();
  if (lower in KNOWN_COLORS) return KNOWN_COLORS[lower] as (t: string) => string;
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return COLOR_PALETTE[hash % COLOR_PALETTE.length] as (t: string) => string;
}

const LEVEL_ICONS: Record<LogLevel, string> = {
  info: 'ℹ',
  success: '✓',
  warn: '⚠',
  error: '✗',
  debug: '⋯',
};

const LEVEL_COLORS: Record<LogLevel, (t: string) => string> = {
  info: chalk.blue,
  success: chalk.green,
  warn: chalk.yellow,
  error: chalk.red,
  debug: chalk.gray,
};

function formatTimestamp(): string {
  return chalk.gray(new Date().toISOString().substring(11, 23));
}

function log(
  name: string,
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[getMinLevel()]) return;

  const timestamp = formatTimestamp();
  const icon = LEVEL_COLORS[level](LEVEL_ICONS[level]);
  const tag = nameToColor(name)(`[${name.toUpperCase()}]`);
  const msg = LEVEL_COLORS[level](message);

  console.log(`${timestamp} ${icon} ${tag} ${msg}`);

  if (details && Object.keys(details).length > 0) {
    const detailStr = JSON.stringify(details, null, 2)
      .split('\n')
      .map((line) => `    ${chalk.gray(line)}`)
      .join('\n');
    console.log(detailStr);
  }
}

export function createLogger(name: string): ComponentLogger {
  return {
    info: (msg, details) => log(name, 'info', msg, details),
    success: (msg, details) => log(name, 'success', msg, details),
    warn: (msg, details) => log(name, 'warn', msg, details),
    error: (msg, details) => log(name, 'error', msg, details),
    debug: (msg, details) => log(name, 'debug', msg, details),
  };
}

function logStep(step: number, name: string, message: string): void {
  if (LEVEL_ORDER['info'] < LEVEL_ORDER[getMinLevel()]) return;

  const timestamp = formatTimestamp();
  const stepNum = chalk.bold.white(`[Step ${step}]`);
  const tag = nameToColor(name)(`[${name.toUpperCase()}]`);
  console.log(`${timestamp} ${stepNum} ${tag} ${message}`);
}

function logSeparator(title?: string): void {
  if (title) {
    console.log(chalk.gray(`\n${'─'.repeat(20)} ${title} ${'─'.repeat(20)}\n`));
  } else {
    console.log(chalk.gray('─'.repeat(60)));
  }
}

/** Agent Service 向けの共有ロガー。コンポーネント別インスタンスと表示ユーティリティを1つに集約する。 */
export const logger = {
  agent: createLogger('agent'),
  llm: createLogger('llm'),
  logic: createLogger('logic'),
  payment: createLogger('payment'),
  http: createLogger('http'),
  eval: createLogger('eval'),
  step: logStep,
  separator: logSeparator,
};
