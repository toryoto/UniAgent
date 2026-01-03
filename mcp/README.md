# MCP Server

A2A Discovery MCP Server - エージェント検索用MCPサーバー。

## 概要

ブロックチェーン上のAgentRegistryからエージェントを検索し、`.well-known/agent.json`からA2Aエンドポイント情報を取得して返す。

## セットアップ

**注意**: このプロジェクトはモノレポ構成です。依存関係のインストールは**ルートディレクトリ**から実行してください。

```bash
# ルートディレクトリから依存関係をインストール
npm install

# 環境変数設定（.env.exampleを参照）
cp .env.example .env
# .envを編集
```

### 環境変数

環境変数の詳細は `.env.example` を参照してください。

## 実行

```bash
# ルートディレクトリから実行（推奨）
npm run dev --workspace=mcp
npm run start --workspace=mcp

# または、mcpディレクトリ内から実行
cd mcp
npm run dev
npm run start
```

## エンドポイント

- **SSE**: `http://localhost:3001/sse`
- **HTTP**: `http://localhost:3001/mcp`

## ツール

### discover_agents

エージェントを検索（カテゴリ、スキル名、価格、評価でフィルタ可能）。
**パラメータ:**

- `category` (optional): 検索するカテゴリ
- `skillName` (optional): 検索するスキル名（部分一致）
- `maxPrice` (optional): 最大価格（USDC）
- `minRating` (optional): 最小評価（0-5）

**返却値:**

- `agents`: 検索されたエージェントの配列
- `total`: 検索結果の総数
- `source`: データソース（'on-chain'）
