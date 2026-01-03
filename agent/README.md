# Agent Service

LangChain.jsを使用したAIエージェント実行サービス（Paygent X）。

## 概要

ユーザーのタスクを受け取り、LLMが分析して必要なエージェントを発見・実行するサービス。A2Aプロトコルとx402決済を統合。

## セットアップ

**注意**: このプロジェクトはモノレポ構成です。依存関係のインストールは**ルートディレクトリ**から実行してください。

```bash
# ルートディレクトリから依存関係をインストール
npm install

# 環境変数設定（.env.exampleを参照）
cp .env.example .env
# .envを編集

# 開発サーバー起動（ルートまたはagentディレクトリから）
npm run dev --workspace=agent
# または
cd agent && npm run dev
```

### 環境変数

環境変数の詳細は `.env.example` を参照してください。

## API

### POST /api/agent

```json
{
  "message": "パリ3日間の旅行プランを作成して",
  "walletId": "wallet_xxx",
  "maxBudget": 5.0
}
```

## 実行フロー

1. LLMがタスクを分析
2. `discover_agents`でエージェント検索
3. `execute_agent`でx402決済付き実行
4. 結果を統合して返却

## コマンド

```bash
# ルートディレクトリから実行（推奨）
npm run dev --workspace=agent
npm run build --workspace=agent
npm start --workspace=agent

# または、agentディレクトリ内から実行
cd agent
npm run dev
npm run build
npm start
```
