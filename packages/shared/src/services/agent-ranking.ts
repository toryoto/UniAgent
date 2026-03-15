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

/** Bayesian prior strength — レビュー C 件未満は全体平均に寄せる */
const BAYESIAN_C = 3;

/** Deposit 上限 (USDC)。これ以上は 1.0 にクランプ */
const DEPOSIT_CAP = 500;

/** Freshness 減衰率 (half-life ≈ 14 days) */
const FRESHNESS_LAMBDA = 0.05;

/** Cold Pool 閾値 — ratingCount がこの値未満はコールドスタート */
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
 * Deposit score — log1p 正規化 (0-1)
 * D(d) = min(1, log1p(d) / log1p(CAP))
 */
function depositScore(stakedAmount: number): number {
  if (stakedAmount <= 0) return 0;
  return Math.min(1, Math.log1p(stakedAmount) / Math.log1p(DEPOSIT_CAP));
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
