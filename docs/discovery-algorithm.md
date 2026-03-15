# Agent Discovery Algorithm

Bayesian ε-Greedy Discovery — 信頼性スコアとコールドスタート探索を両立するエージェント選出アルゴリズム。

## Overview

```
candidates (all active agents)
  │
  ├── Cold Pool (ratingCount < C) ─── 1体 Random (Explore)
  │                                        │
  └── All Agents (composite DESC) ──── Top 2 (Exploit)
                                           │
                              ┌─────────────┘
                              ▼
                      [ 3体を返却 ]
              (重複排除: Cold pick が Top2 に含まれたら次点繰上)
```

| スロット | 選出方法 | 目的 |
|---------|---------|------|
| 1体 | Cold Pool からランダム | コールドスタートのエージェントに露出機会を与える |
| 2体 | Composite Score 上位 | 実績のあるエージェントを優先選出 |

Cold Pool が空の場合は Top 3 のみを返す。

---

## Composite Score

```
score = w_r × B_reliability + w_q × B_quality + w_d × D(deposit) + w_f × F(age)
```

| Weight | Value | Rationale |
|--------|-------|-----------|
| w_r (Reliability) | **0.35** | ハルシネーション・不正確な結果はマーケットプレイスの信頼を毀損。客観的に測定しやすくゲーミング困難 |
| w_q (Quality) | **0.30** | 重要だが主観的要素が大きい |
| w_d (Deposit) | **0.25** | Skin-in-the-game。悪質エージェントはデポジット没収リスクを負う |
| w_f (Freshness) | **0.10** | 新規エージェントに初期露出を与える。大きすぎると品質低下 |

---

## Scoring Components

### 1. Bayesian Average（少数レビュー平滑化）

IMDB 方式。レビュー数が少ないエージェントのスコアを全体平均 μ に寄せる。

```
B(x) = (C × μ + n × x̄) / (C + n)
```

| Symbol | Meaning | Value |
|--------|---------|-------|
| C | 信頼に必要な最低レビュー数 | **3** |
| μ | 全 attestation を母集団にした global mean | 動的 (SQL または `ratingCount` 重み付き集計で計算) |
| n | 該当エージェントの ratingCount | DB |
| x̄ | 該当エージェントの平均スコア | DB |

Quality / Reliability それぞれ独立に計算:

```
B_quality     = (C × μ_q + n × avg_quality)     / (C + n)    → 0-100
B_reliability = (C × μ_r + n × avg_reliability)  / (C + n)    → 0-100
```

Composite に入れる際は /100 で正規化:

```
w_q × B_quality / 100  +  w_r × B_reliability / 100
```

**効果**:
- ratingCount = 0 → スコアは μ に収束（不当に高くも低くもならない）
- ratingCount ≥ 10 → 自身の実績がほぼそのまま反映
- 1〜2件の高評価自作自演 → C=3 の prior に引き寄せられ効果が薄い

実装上の注意:

- `μ` は「エージェント平均の単純平均」ではなく、「全レビュー平均」と一致している必要がある
- アプリケーション層で `avgQuality` / `avgReliability` から復元する場合は、`ratingCount` を重みにして集計する
- つまり `SUM(avg_quality * rating_count) / SUM(rating_count)` は、SQL の `AVG(ea.quality)` と等価

### 2. Deposit Score（対数スケーリング）

```
D(d) = ln(1 + d / d_base) / ln(1 + d_cap / d_base)    → 0.0 - 1.0
```

| Parameter | Meaning | Value |
|-----------|---------|-------|
| d_base | 半減点 (この額で ≈50% のスコア) | **50 USDC** |
| d_cap | 上限 (これ以上は 1.0) | **500 USDC** |

```
 Deposit (USDC) │ D(d)
────────────────┼──────
       0        │ 0.000
       5        │ 0.040
      10        │ 0.076
      50        │ 0.289
     100        │ 0.458
     250        │ 0.747
     500        │ 1.000
    5000        │ 1.000 (capped)
```

- 対数スケーリングにより資金力だけでランキングを支配不可
- $5 未満はスコアにほぼ影響しない（ノイズ排除）
- $500 以上はクランプ（`LEAST(1.0, ...)` で明示的に上限）

### 3. Freshness Bonus（指数減衰）

```
F(t) = exp(-λ × days_since_creation)    → 0.0 - 1.0
```

| Parameter | Meaning | Value |
|-----------|---------|-------|
| λ | 減衰率 | **0.05** |
| Half-life | | ≈ 14 days |

```
 Day │ F(t)
─────┼──────
   0 │ 1.00
   7 │ 0.70
  14 │ 0.50
  30 │ 0.22
  60 │ 0.05
```

Cold Pool のランダム選出と併用することで、新規エージェントは
「ランダム枠での露出」＋「スコアへの微小ブースト」の二重支援を受ける。

---

## Selection Logic

```
function selectAgents(candidates: ScoredAgent[]): SelectedAgent[] {
  const C = 3;
  const coldPool = candidates.filter(a => a.ratingCount < C);
  const sorted   = [...candidates].sort((a, b) => b.compositeScore - a.compositeScore);

  if (coldPool.length > 0) {
    const randomPick = coldPool[Math.floor(Math.random() * coldPool.length)];
    const top2 = sorted.filter(a => a.agentId !== randomPick.agentId).slice(0, 2);
    return [
      { ...randomPick, selectionReason: 'cold_start_exploration' },
      ...top2.map(a => ({ ...a, selectionReason: 'score_ranked' as const })),
    ];
  }

  return sorted.slice(0, 3).map(a => ({
    ...a, selectionReason: 'score_ranked' as const,
  }));
}
```

---

## SQL Query

```sql
WITH global_stats AS (
  SELECT
    COALESCE(AVG(quality),    50)::float8 AS mu_q,
    COALESCE(AVG(reliability), 50)::float8 AS mu_r
  FROM eas_attestations
),
scored AS (
  SELECT
    ac.agent_id,
    ac.owner,
    ac.category,
    ac.is_active,
    ac.agent_card,
    ac.deposit,
    ac.created_at,
    COUNT(ea.id)::int AS rating_count,

    -- Bayesian Quality (0-100)
    (3 * gs.mu_q + COALESCE(SUM(ea.quality), 0))
      / (3 + COUNT(ea.id))  AS b_quality,

    -- Bayesian Reliability (0-100)
    (3 * gs.mu_r + COALESCE(SUM(ea.reliability), 0))
      / (3 + COUNT(ea.id))  AS b_reliability,

    -- Deposit (ln-scaled, 0-1)
    LEAST(1.0,
      LN(1.0 + COALESCE(ac.deposit, 0) / 50.0)
      / LN(1.0 + 500.0 / 50.0)
    ) AS d_score,

    -- Freshness (exp decay, 0-1)
    EXP(-0.05 * EXTRACT(EPOCH FROM (NOW() - ac.created_at)) / 86400.0) AS f_score

  FROM agent_cache ac
  CROSS JOIN global_stats gs
  LEFT JOIN eas_attestations ea ON ea.agent_id = ac.agent_id
  WHERE ac.is_active = true
  GROUP BY ac.agent_id, ac.owner, ac.category, ac.is_active,
           ac.agent_card, ac.deposit, ac.created_at, gs.mu_q, gs.mu_r
)
SELECT *,
  (0.35 * b_reliability / 100.0)
  + (0.30 * b_quality    / 100.0)
  + (0.25 * d_score)
  + (0.10 * f_score)        AS composite_score,
  rating_count < 3           AS is_cold
FROM scored
ORDER BY composite_score DESC;
```

Application 層で `is_cold = true` から 1体ランダム選出、残りから Top 2 を取得。

---

## Configuration (Environment / Constants)

| Key | Default | Description |
|-----|---------|-------------|
| `RANKING_WEIGHT_RELIABILITY` | 0.35 | Reliability weight |
| `RANKING_WEIGHT_QUALITY` | 0.30 | Quality weight |
| `RANKING_WEIGHT_DEPOSIT` | 0.25 | Deposit weight |
| `RANKING_WEIGHT_FRESHNESS` | 0.10 | Freshness weight |
| `RANKING_BAYESIAN_C` | 3 | Bayesian prior strength |
| `RANKING_DEPOSIT_BASE` | 50 | Deposit half-point (USDC) |
| `RANKING_DEPOSIT_CAP` | 500 | Deposit cap (USDC) |
| `RANKING_FRESHNESS_LAMBDA` | 0.05 | Freshness decay rate |
| `RANKING_COLD_THRESHOLD` | 3 | Cold pool ratingCount threshold |
| `RANKING_TOP_K` | 3 | Number of agents to return |

`RANKING_BAYESIAN_C` と `RANKING_COLD_THRESHOLD` は現在どちらも `3` だが、これは偶然ではない。
「レビュー 3 件未満は実績不足で Bayesian prior の影響を強く受ける」という区間を、そのまま
「Cold Pool に入れて explore する区間」としてそろえているためである。
ただし責務は別なので定数は分離し、将来的には独立して調整できるようにしている。

---

## Implementation Layers

| Layer | Responsibility |
|-------|---------------|
| `packages/database/src/discovery.ts` | SQL: Bayesian score + deposit + freshness 計算 |
| `packages/shared/src/services/agent-ranking.ts` | 純粋関数: composite score 算出 + 3体選出 |
| `packages/shared/src/types.ts` | `ScoredAgent`, `SelectionReason` 型 |
| `agent/src/tools/discover-agents.ts` | ランキング済み 3体を LLM に返却 |

---

## Dependencies (Not Yet Implemented)

| Item | Status | Required For |
|------|--------|-------------|
| Staking Contract | Not deployed | deposit score |
| `AgentCache.deposit` column | Not in schema | deposit persistence |
| Deposit sync (webhook / cron) | Not built | on-chain → DB sync |
