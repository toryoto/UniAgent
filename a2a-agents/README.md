# a2a-agents

ホテルドメインに特化した A2A エージェントサーバー。検索アルゴリズム（Bayesian ε-Greedy）やエージェント評価のテスト用に、多様な品質・形式の 24 体のエージェントを 1 サーバーから提供する。

## 起動

```bash
# 開発（x402 決済スキップ）
X402_DISABLED=true npm run dev --workspace=a2a-agents

# http://localhost:3003
```

## エージェント一覧

`agents.yaml` で宣言的に定義。品質レベル 4 段階 × レスポンス形式 6 種 × リクエスト形式 4 種の組み合わせ。

| 品質 | 体数 | 特徴 |
|------|------|------|
| high | 6 | 全フィールド充実、正確なフィルタリング |
| medium | 8 | 基本的に正確、一部欠損 |
| low | 5 | 最小限、不正確なデータ混入 |
| unreliable | 5 | errorRate / latencyMs でエラー・遅延発生 |

## API

```
GET  /:slug/.well-known/agent.json   # エージェントメタデータ
GET  /:slug/openapi.json              # OpenAPI 仕様
POST /:slug                           # A2A 実行（x402 決済）
GET  /health                          # ヘルスチェック
GET  /agents                          # 全エージェント一覧
```

## リクエスト形式

| 形式 | 説明 |
|------|------|
| `a2a-standard` | `params.message.parts: [{ kind: 'data', data: {...} }]` |
| `natural-language` | `params.message.parts: [{ kind: 'text', text: '...' }]` |
| `flat` | `params: { city: '...', checkIn: '...' }` |
| `mixed-input` | TextPart + DataPart の組み合わせ |

## レスポンス形式

| 形式 | 説明 |
|------|------|
| `text-only` | A2A TextPart（自然言語） |
| `data-only` | A2A DataPart（構造化 JSON） |
| `mixed` | テキスト要約 + 構造化データ |
| `legacy-flat` | `{ hotels, searchParams, timestamp }`（非 A2A） |
| `nested` | 都市別・価格帯別グルーピング |
| `markdown` | Markdown 形式（レビュー含む） |

## スクリプト

```bash
# オンチェーン一括登録 + IPFS アップロード
PINATA_JWT=... PRIVATE_KEY=0x... npm run register --workspace=a2a-agents

# IPFS のみ（オンチェーンスキップ）
npm run register --workspace=a2a-agents -- --dry-run

# DB シード（AgentCache / EasAttestation / AgentStake）
DATABASE_URL=... npm run seed --workspace=a2a-agents

# 既存シードデータを削除して再作成
npm run seed --workspace=a2a-agents -- --clean
```

## 環境変数

`.env.example` を参照。主要な変数:

| 変数 | 用途 |
|------|------|
| `X402_DISABLED` | `true` で決済スキップ（開発用） |
| `PINATA_JWT` | IPFS アップロード用 |
| `PRIVATE_KEY` | オンチェーン登録用 |
| `DATABASE_URL` | DB シード用 |
| `BASE_URL` | エージェントの公開 URL（デフォルト `http://localhost:3003`） |
