/**
 * @module config/constants
 * agent パッケージ全体で使用する定数を一元管理する。
 */

// ── LLM ──────────────────────────────────────────────────────────────────

/** Agent 実行・評価 (LLM-as-a-Judge) で共通利用するモデル ID */
export const AGENT_MODEL = 'claude-sonnet-4-5-20250929';

// ── Blockchain ───────────────────────────────────────────────────────────

/** Base Sepolia Chain ID */
export const CHAIN_ID = 84532;

/** CAIP-2 形式のネットワーク識別子 */
export const NETWORK_ID = `eip155:${CHAIN_ID}`;

// ── Timeouts ─────────────────────────────────────────────────────────────

/** agent.json 取得時のタイムアウト (ms) */
export const AGENT_JSON_TIMEOUT_MS = 5000;

/** A2A エージェントへのリクエストタイムアウト (ms) */
export const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS ?? 120_000);

// ── EAS (Ethereum Attestation Service) ───────────────────────────────────

/** Base Sepolia 上の EAS コントラクトアドレス */
export const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';

/** EAS スキーマ定義文字列 */
export const EAS_SCHEMA =
  'uint256 agentId, bytes32 paymentTx, uint256 chainId, uint8 quality, uint8 reliability, uint32 latency, uint64 timestamp, string[] tags';

// ── Payment Retry ────────────────────────────────────────────────────────

/** x402 facilitator 競合時のリトライ上限 */
export const MAX_PAYMENT_RETRIES = 2;
