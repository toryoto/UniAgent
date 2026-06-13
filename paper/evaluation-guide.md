# UniAgent Evaluation Guide

## 目的

UniAgent の Evaluation では、提案アーキテクチャがユーザーの自然言語タスクを、エージェント発見・仕様確認・A2A 実行・x402 決済まで end-to-end に完了できるかを測定する。

主に確認することは以下。

- ReAct orchestrator が適切な agent を発見・選択できるか
- A2A agent 呼び出しが成功するか
- x402 payment が正常に verify / settle されるか
- 失敗時に fallback できるか
- 実行時間・決済時間・失敗原因を定量的に記録できるか

## 測定対象

論文の現状に合わせ、評価対象は以下の3シナリオとする。

### S1: Single-Agent Task

目的: 単一 hotel agent で完了するタスクの成功率を測る。

例:

```text
Search for a hotel in Tokyo for 2 adults from July 24 to July 26, 2026.
```

成功条件:

- `discover_agents` が hotel agent を返す
- `fetch_agent_spec` で仕様を取得できる
- `execute_and_evaluate_agent` が成功する
- x402 payment transaction hash が取得できる
- 最終回答に hotel result が含まれる

### S2: Multi-Agent Task

目的: flight agent と hotel agent を連鎖実行できるかを測る。

例:

```text
Plan a three-day trip to Paris from Tokyo for one traveler, including flight and hotel options.
```

成功条件:

- タスクが flight と hotel に分解される
- 各カテゴリで agent discovery が行われる
- flight agent と hotel agent の両方が実行される
- 各実行で x402 payment が成功する
- 最終回答に flight result と hotel result が統合される

### S3: Agent Failure / Fallback

目的: 選択 agent が失敗した場合に代替 agent へ fallback できるかを測る。

例:

```text
Search for a hotel in Tokyo using the best available hotel agent. If the selected agent fails, use an alternative.
```

成功条件:

- 最初の agent 実行で timeout / error / non-response を観測する
- orchestrator が代替候補を選択する
- 代替 agent の実行に成功する
- 最終回答に fallback が行われたことが分かる結果が含まれる

## 推奨 Run 数

最低限:

```text
N = 10 per scenario
Total = 30 runs
```

時間があれば:

```text
N = 20 per scenario
Total = 60 runs
```

論文には `N=10` でも書けるが、ばらつきが大きい場合は `N=20` の方が説得力がある。

## 評価ケース

以下のケースを `N=10 per scenario` の基本セットとして使用する。各ケースは1回ずつ実行し、同一条件で再測定したい場合は同じセットを2周して `N=20` とする。

### S1: Single-Agent Task Cases

単一 hotel agent だけで解けるケース。成功判定では、hotel agent の発見・仕様確認・有償実行・hotel result の返却を確認する。

| Case ID | Prompt | Expected behavior |
| --- | --- | --- |
| S1-01 | Search for a hotel in Tokyo for 2 adults from July 24 to July 26, 2026. | Tokyo の hotel agent を選択し、宿泊候補を返す |
| S1-02 | Find a hotel in Paris for one traveler from August 10 to August 13, 2026. | Paris の hotel 検索を実行し、候補を返す |
| S1-03 | Search for a business hotel in London for 1 adult from September 3 to September 5, 2026. | London の business travel 向け hotel 候補を返す |
| S1-04 | Find a family-friendly hotel in Singapore for 2 adults and 2 children from July 15 to July 18, 2026. | Singapore の family 条件に合う hotel 候補を返す |
| S1-05 | Search for a budget hotel in Bangkok for 2 adults from October 1 to October 4, 2026. | Bangkok の budget 条件を反映した hotel 候補を返す |
| S1-06 | Find a luxury hotel in Sydney for 2 adults from November 12 to November 15, 2026. | Sydney の luxury 条件を反映した hotel 候補を返す |
| S1-07 | Search for a hotel near Shinjuku, Tokyo for one traveler from July 24 to July 25, 2026. | Shinjuku / Tokyo 周辺の hotel 候補を返す |
| S1-08 | Find a hotel in New York for 2 adults from December 20 to December 23, 2026. | New York の hotel 検索を実行し、候補を返す |
| S1-09 | Search for a hotel in Seoul for one traveler from August 1 to August 3, 2026. | Seoul の hotel 検索を実行し、候補を返す |
| S1-10 | Find a hotel in Osaka for 2 adults from September 18 to September 20, 2026. | Osaka の hotel 検索を実行し、候補を返す |

### S2: Multi-Agent Task Cases

flight agent と hotel agent の両方が必要なケース。成功判定では、タスク分解、2カテゴリの discovery、2回の paid execution、最終回答での統合を確認する。

| Case ID | Prompt | Expected behavior |
| --- | --- | --- |
| S2-01 | Plan a three-day trip to Paris from Tokyo for one traveler, including flight and hotel options. | Tokyo to Paris の flight と Paris hotel を取得して統合する |
| S2-02 | Plan a business trip from Tokyo to London from September 3 to September 5, 2026, including flights and a business hotel. | London 行き flight と business hotel を統合する |
| S2-03 | Plan a family trip from Tokyo to Singapore from July 15 to July 18, 2026, including flights and a family-friendly hotel. | Singapore 行き flight と family-friendly hotel を統合する |
| S2-04 | Plan a budget trip from Tokyo to Bangkok from October 1 to October 4, 2026, including low-cost flights and budget hotel options. | Bangkok 行き flight と budget hotel を統合する |
| S2-05 | Plan a luxury weekend trip from Tokyo to Sydney from November 12 to November 15, 2026, including flights and a luxury hotel. | Sydney 行き flight と luxury hotel を統合する |
| S2-06 | Plan a short trip from Osaka to Seoul from August 1 to August 3, 2026, including flight and hotel recommendations. | Osaka to Seoul の flight と Seoul hotel を統合する |
| S2-07 | Plan a conference trip from Tokyo to New York from December 20 to December 23, 2026, including flights and hotel options. | New York 行き flight と hotel を統合する |
| S2-08 | Plan a two-night trip from Tokyo to London for one traveler, including an economy flight and hotel options. | economy flight と London hotel を統合する |
| S2-09 | Plan a trip from Tokyo to Paris for two adults from August 10 to August 13, 2026, including flights and hotel options. | 2名分条件で flight と hotel を統合する |
| S2-10 | Plan a weekend trip from Tokyo to Singapore for one traveler from July 24 to July 26, 2026, including flight and hotel options. | Singapore 行き flight と hotel を統合する |

### S3: Agent Failure / Fallback Cases

fallback を測るケース。各ケースでは、評価前に失敗注入用の agent または timeout / error を起こす設定を用意する。成功判定では、最初の agent 失敗、代替候補の選択、代替 agent の実行成功を確認する。

| Case ID | Prompt | Failure condition | Expected behavior |
| --- | --- | --- | --- |
| S3-01 | Search for a hotel in Tokyo for 2 adults from July 24 to July 26, 2026. If the selected agent fails, use an alternative. | primary hotel agent returns 500 | alternative hotel agent で成功する |
| S3-02 | Find a hotel in Paris for one traveler from August 10 to August 13, 2026. If the first agent times out, try another one. | primary hotel agent timeout | alternative hotel agent で成功する |
| S3-03 | Search for a business hotel in London from September 3 to September 5, 2026. Use another agent if the selected one is unavailable. | primary hotel agent unavailable | alternative hotel agent で成功する |
| S3-04 | Plan a three-day trip to Paris from Tokyo for one traveler, including flights and hotel options. If one selected agent fails, use another provider. | primary hotel agent fails after flight succeeds | flight 結果を保持し、hotel のみ fallback する |
| S3-05 | Plan a trip from Tokyo to Singapore from July 15 to July 18, 2026, including flight and hotel options. Retry with an alternative if a provider fails. | primary flight agent timeout | alternative flight agent と hotel agent で成功する |
| S3-06 | Search for a budget hotel in Bangkok from October 1 to October 4, 2026. If the first provider returns an invalid response, use another. | primary hotel agent returns malformed response | malformed response を失敗扱いし、alternative で成功する |
| S3-07 | Plan a business trip from Tokyo to London from September 3 to September 5, 2026, including flights and hotel options. Recover from provider errors. | primary flight agent returns 500 | alternative flight agent と hotel agent で成功する |
| S3-08 | Find a hotel in Seoul for one traveler from August 1 to August 3, 2026. If payment settlement fails for the selected provider, use another. | x402 settlement fails for primary hotel agent | payment failure を検出し、alternative で成功する |
| S3-09 | Plan a weekend trip from Tokyo to Singapore from July 24 to July 26, 2026. Use fallback providers when needed. | primary hotel agent timeout | flight 結果を保持し、hotel fallback で成功する |
| S3-10 | Search for a hotel in Osaka for 2 adults from September 18 to September 20, 2026. If the selected agent does not respond, choose another one. | primary hotel agent non-response | alternative hotel agent で成功する |

## 記録する Metrics

各 run で以下を記録する。

```text
scenario
run_id
prompt
started_at
ended_at
end_to_end_latency_ms
discovery_latency_ms
spec_fetch_latency_ms
execution_latency_ms
payment_settlement_latency_ms
selected_agent_id
selected_agent_category
payment_amount_usdc
payment_tx_hash
success
failure_type
notes
```

`failure_type` は以下のいずれかに分類する。

```text
none
llm_selection_error
a2a_communication_error
x402_payment_timeout
x402_payment_failure
agent_runtime_error
fallback_failed
manual_abort
unknown
```

## 実行前チェック

1. Web app / Agent service / A2A agents が起動していることを確認する。
2. Base Sepolia の RPC が使えることを確認する。
3. Privy delegated wallet が有効であることを確認する。
4. x402 payment 用の USDC 残高が十分あることを確認する。
5. marketplace cache に flight / hotel agent が登録されていることを確認する。
6. 各 agent の `.well-known/agent.json` と OpenAPI spec が取得できることを確認する。
7. 実行ログ、transaction hash、latency を保存できる状態にする。

## 測定手順

### Step 1: Baseline Health Check

まず各コンポーネントが単体で動くか確認する。

- marketplace で agent 一覧が表示される
- chat UI から simple hotel query が送れる
- `discover_agents` が候補を返す
- `fetch_agent_spec` が agent spec を返す
- `execute_and_evaluate_agent` が payment 付きで成功する

ここで失敗する場合、Evaluation ではなく実装・環境の問題として先に修正する。

### Step 2: S1 を実行する

同じ prompt を `N` 回実行する。

各 run で以下を確認する。

- hotel agent が選択されたか
- payment が成功したか
- final answer が hotel search result を含むか
- latency と tx hash を記録したか

記録例:

```csv
scenario,run_id,success,failure_type,end_to_end_latency_ms,payment_settlement_latency_ms,payment_tx_hash,notes
S1,1,true,none,18420,6200,0x...,hotel result returned
```

### Step 3: S2 を実行する

multi-agent prompt を `N` 回実行する。

各 run で以下を確認する。

- flight sub-task と hotel sub-task に分解されたか
- flight agent と hotel agent の両方が実行されたか
- payment が2回発生したか
- final itinerary に両方の結果が入っているか

部分成功は失敗として扱う。

例:

- flight 成功、hotel 失敗: `success=false`
- payment 1件のみ成功: `success=false`
- final answer が片方しか含まない: `success=false`

### Step 4: S3 を実行する

fallback を測るため、意図的に失敗しやすい agent を使うか、timeout / unavailable agent を含める。

各 run で以下を確認する。

- 最初の agent が失敗したことをログで確認できるか
- 代替 agent が選択されたか
- 代替 agent の execution と payment が成功したか
- final answer が返ったか

fallback が成功した場合のみ `success=true` とする。

## 集計方法

シナリオごとに成功率を計算する。

```text
success_rate = successful_runs / total_runs * 100
```

論文の Table には最低限以下を入れる。

```text
S1 single agent: N runs, XX% success
S2 multi-agent: N runs, XX% success
S3 agent failure: N runs, XX% success
```

加えて、本文で失敗原因を簡潔に説明する。

例:

```text
Most failures in S2 were caused by LLM selection errors, where the orchestrator selected a hotel agent before collecting sufficient flight constraints.
```

## 論文への反映箇所

`paper/sample-sigconf.tex` の以下を更新する。

### Abstract

現在の "report an end-to-end evaluation" に、実測した成功率を短く入れる。

例:

```text
In an evaluation over three scenarios and 30 runs, UniAgent completed XX% of single-agent tasks, XX% of multi-agent tasks, and recovered from agent failures in XX% of runs.
```

### Evaluation

以下を置換する。

- `N=\texttt{XX}`
- `\texttt{XX}\%`
- `placeholder values`
- placeholder 宣言文

### Discussion

実測結果をもとに、以下を更新する。

- どのシナリオが安定していたか
- どの failure type が支配的だったか
- x402 payment が主な bottleneck だったか
- LLM selection が主な bottleneck だったか
- fallback の限界

## 最終チェックリスト

- [ ] S1 を N 回実行した
- [ ] S2 を N 回実行した
- [ ] S3 を N 回実行した
- [ ] 各 run の tx hash を保存した
- [ ] 各 run の latency を保存した
- [ ] failure type を分類した
- [ ] success rate を計算した
- [ ] `sample-sigconf.tex` の `XX` をすべて置換した
- [ ] Abstract を実測値に合わせて更新した
- [ ] Discussion を実測値に合わせて更新した
- [ ] `make pdf` が成功した
- [ ] PDF 上で表・図・ページ数を確認した
