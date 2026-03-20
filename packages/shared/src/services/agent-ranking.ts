/**
 * Agent Ranking Service
 *
 * Bayesian ε-Greedy Discovery アルゴリズムの純粋関数実装。
 */

import type { DiscoveredAgent, ScoredAgent, SelectedAgent } from '../types.js';

const WEIGHTS = {
  reliability: 0.35,
  quality: 0.3,
  deposit: 0.25,
  freshness: 0.1,
} as const;

/**
 * Bayesian prior strength.
 * 3 件未満はサンプル不足として全体平均に強く寄せる。
 * `COLD_THRESHOLD` と同値にして、「十分な実績がまだない区間」を
 * スコア平滑化と explore 対象の両方で同じ意味にそろえている。
 */
const BAYESIAN_C = 3;

/** Deposit スケールの基準額 (USDC)。d_base — 式 ln(1+d/d_base) の分母側スケール */
const DEPOSIT_BASE = 50;

/** Deposit 上限 (USDC)。d_cap — 正規化の上限、これ以上は 1.0 にクランプ */
const DEPOSIT_CAP = 500;

/** Freshness 減衰率 (half-life ≈ 14 days) */
const FRESHNESS_LAMBDA = 0.05;

/**
 * Cold Pool 閾値.
 * `BAYESIAN_C` と同じ 3 を採用し、Bayesian prior がまだ支配的な
 * エージェントを explore 対象として扱う。
 * 役割は別なので定数は分離し、将来チューニングを独立にできるようにしている。
 */
const COLD_THRESHOLD = 3;

/** 返却するエージェント数 */
const TOP_K = 3;

/** ランキング計算に必要なエージェントの生データ */
export interface AgentWithStats extends DiscoveredAgent {
  avgQuality: number; // 0-100 (attestation 平均)
  avgReliability: number; // 0-100
  createdAt: Date;
}

interface GlobalMeans {
  meanQuality: number;
  meanReliability: number;
}

/**
 * レビューのあるエージェント群から quality / reliability の全体平均を算出。
 * 各エージェントを 1 票として扱うのではなく、ratingCount を重みにした
 * 加重平均にすることで「全 attestation の平均」と等価にする。
 * 全エージェントがレビュー 0 件の場合はデフォルト 50 を返す。
 */
export function computeGlobalMeans(agents: AgentWithStats[]): GlobalMeans {
  const rated = agents.filter((a) => a.ratingCount > 0);
  if (rated.length === 0) {
    return { meanQuality: 50, meanReliability: 50 };
  }
  const totalRatings = rated.reduce((sum, a) => sum + a.ratingCount, 0);
  const meanQuality =
    rated.reduce((sum, a) => sum + a.avgQuality * a.ratingCount, 0) / totalRatings;
  const meanReliability =
    rated.reduce((sum, a) => sum + a.avgReliability * a.ratingCount, 0) / totalRatings;
  return { meanQuality, meanReliability };
}

// ============================================================================
// Scoring
// ============================================================================

/**
 * Bayesian Average (IMDB 方式)
 * B(x) = (C × μ + n × x̄) / (C + n)
 */
function bayesianAverage(globalMean: number, agentMean: number, count: number): number {
  return (BAYESIAN_C * globalMean + count * agentMean) / (BAYESIAN_C + count);
}

/**
 * Deposit score — 対数スケール正規化 (0-1)
 * D(d) = min(1, ln(1 + d/d_base) / ln(1 + d_cap/d_base))
 * d は USDC 相当のステーク量（`agent_stakes.staked_amount`）
 */
function depositScore(stakedAmount: number): number {
  if (stakedAmount <= 0) return 0;
  const numer = Math.log1p(stakedAmount / DEPOSIT_BASE);
  const denom = Math.log1p(DEPOSIT_CAP / DEPOSIT_BASE);
  return Math.min(1, numer / denom);
}

/**
 * Freshness score — 指数減衰 (0-1)
 * F(t) = exp(-λ × days_since_creation)
 */
function freshnessScore(createdAt: Date, now: Date): number {
  const daysSince = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  return Math.exp(-FRESHNESS_LAMBDA * Math.max(0, daysSince));
}

/**
 * 全エージェントにスコアを付与する。
 */
export function scoreAgents(agents: AgentWithStats[], means: GlobalMeans): ScoredAgent[] {
  const now = new Date();

  return agents.map((agent) => {
    const bQuality = bayesianAverage(means.meanQuality, agent.avgQuality, agent.ratingCount);
    const bReliability = bayesianAverage(
      means.meanReliability,
      agent.avgReliability,
      agent.ratingCount
    );
    const dScore = depositScore(agent.stakedAmount ?? 0);
    const fScore = freshnessScore(agent.createdAt, now);

    const composite =
      WEIGHTS.reliability * (bReliability / 100) +
      WEIGHTS.quality * (bQuality / 100) +
      WEIGHTS.deposit * dScore +
      WEIGHTS.freshness * fScore;

    return {
      ...agent,
      bayesianQuality: bQuality,
      bayesianReliability: bReliability,
      depositScore: dScore,
      freshnessScore: fScore,
      compositeScore: composite,
      isCold: agent.ratingCount < COLD_THRESHOLD,
    };
  });
}

// ============================================================================
// Selection (Bayesian ε-Greedy)
// ============================================================================

/**
 * スコア付きエージェントから最大 TOP_K 体を選出する。
 *
 * - Cold Pool (ratingCount < C) から 1 体ランダム選出 (explore)
 * - 残りから composite DESC で Top 2 (exploit)
 * - Cold Pool が空なら Top 3 のみ
 * - 重複排除: cold pick が Top 2 に含まれたら次点繰上
 */
export function selectAgents(candidates: ScoredAgent[]): SelectedAgent[] {
  if (candidates.length === 0) return [];

  const coldPool = candidates.filter((a) => a.isCold);
  const sorted = [...candidates].sort((a, b) => b.compositeScore - a.compositeScore);

  if (coldPool.length > 0) {
    const randomPick = coldPool[Math.floor(Math.random() * coldPool.length)];
    const top = sorted
      .filter((a) => a.agentId !== randomPick.agentId)
      .slice(0, TOP_K - 1);

    return [
      { ...randomPick, selectionReason: 'cold_start_exploration' as const },
      ...top.map((a) => ({ ...a, selectionReason: 'score_ranked' as const })),
    ];
  }

  return sorted
    .slice(0, TOP_K)
    .map((a) => ({ ...a, selectionReason: 'score_ranked' as const }));
}
