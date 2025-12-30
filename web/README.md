# Agent Marketplace - Web Application

Next.js 15とReact 19で構築された、AIエージェント向け分散型マーケットプレイスのWebアプリケーション。

## 技術スタック

- **フレームワーク**: Next.js 15 (App Router)
- **UI**: React 19, Tailwind CSS
- **認証・ウォレット**: Privy
- **ブロックチェーン**: ethers.js, wagmi
- **状態管理**: React Query (@tanstack/react-query)
- **型安全性**: TypeScript

## ディレクトリ構造

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx         # ルートレイアウト
│   ├── page.tsx           # トップページ
│   ├── marketplace/       # マーケットプレイス
│   ├── chat/              # チャット画面
│   ├── history/           # トランザクション履歴
│   ├── wallet/            # ウォレット管理
│   └── api/               # API Routes
│       ├── discovery/     # エージェント検索API
│       ├── transactions/  # トランザクション管理API
│       └── ratings/       # 評価管理API
├── components/
│   ├── ui/                # 再利用可能なUIコンポーネント
│   ├── layout/            # レイアウトコンポーネント
│   ├── chat/              # チャット関連コンポーネント
│   ├── marketplace/       # マーケットプレイス関連
│   ├── wallet/            # ウォレット関連
│   └── providers.tsx      # プロバイダー設定
└── lib/
    ├── blockchain/        # ブロックチェーン関連
    │   ├── config.ts      # チェーン設定
    │   ├── contract.ts    # コントラクト操作
    │   └── wagmi.ts       # Wagmi設定
    ├── types/             # TypeScript型定義
    ├── utils/             # ユーティリティ関数
    └── hooks/             # カスタムフック
```

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.local.example`をコピーして`.env.local`を作成し、必要な値を設定します。

```bash
cp .env.local.example .env.local
```

必要な環境変数:

- `NEXT_PUBLIC_PRIVY_APP_ID`: PrivyアプリケーションID
- `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS`: AgentRegistryコントラクトアドレス (Base Sepolia: `0xe2B64700330af9e408ACb3A04a827045673311C1`)
- `NEXT_PUBLIC_USDC_ADDRESS`: USDCトークンアドレス (Base Sepolia: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- `NEXT_PUBLIC_CHAIN`: チェーン選択（`base-sepolia` / `base`）。未設定時は `base-sepolia`（x402 SDKがBase Sepoliaをサポート）
- `NEXT_PUBLIC_RPC_URL`: RPCエンドポイント（任意、未設定ならチェーンのデフォルトを使用）
- `RPC_URL`: サーバー用RPC（Webhookなどサーバー処理向け。`NEXT_PUBLIC_RPC_URL` より優先）
- `CLAUDE_API_KEY`: Claude API Key (サーバーサイドのみ)
- `ALCHEMY_WEBHOOK_SIGNING_KEY`: Alchemy Webhook 署名検証用キー（設定すると検証が必須）
- `ALCHEMY_WEBHOOK_DISABLE_SIGNATURE_VERIFY`: `true` の場合、署名検証をスキップ（開発用）

### 3. 開発サーバーの起動

```bash
npm run dev
```

アプリケーションは [http://localhost:3000](http://localhost:3000) で起動します。

## 主要機能

### 1. ユーザー認証・ウォレット管理

- Privyによるソーシャルログイン
- ウォレット自動作成
- USDC入金・管理

### 2. エージェント検索・発見

- マーケットプレイス画面
- カテゴリ・価格・評価による検索
- AgentCard詳細表示

### 3. チャットインターフェース

- Claudeエージェントとの対話
- MCP Tools呼び出し
- 実行ログ表示

### 4. トランザクション履歴

- 決済履歴の表示
- 評価入力
- 統計情報

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# 本番サーバー起動
npm start

# リンター実行
npm run lint

# 型チェック
npm run type-check
```

## コントラクト連携

スマートコントラクトとの連携は`src/lib/blockchain/contract.ts`で管理されています。

主要な関数:

- `getAllAgentIds()`: 全エージェントID取得
- `getAgentCard(agentId)`: AgentCard詳細取得
- `recordTransaction()`: トランザクション記録
- `updateTransactionRating()`: 評価更新

## Alchemy Webhook設定

Base Sepolia用のAlchemy Webhook設定については、[Alchemy Webhook セットアップガイド](./docs/ALCHEMY_WEBHOOK_SETUP.md)を参照してください。

## プロバイダー構成

アプリケーション全体で使用するプロバイダー:

1. **PrivyProvider**: 認証とウォレット管理
2. **WagmiProvider**: イーサリアムとの統合
3. **QueryClientProvider**: データフェッチングとキャッシング

## スタイリング

Tailwind CSSを使用したユーティリティファーストのスタイリング。

共通のユーティリティ関数:

- `cn()`: クラス名のマージ (`src/lib/utils/cn.ts`)
- `formatUSDC()`: USDC金額フォーマット
- `formatAddress()`: アドレス短縮表示

## 型定義

全ての型定義は`src/lib/types/index.ts`に集約されています。

主要な型:

- `AgentCard`: エージェント情報
- `Transaction`: トランザクション情報
- `ChatMessage`: チャットメッセージ
- `MCPTool*`: MCP Tool関連の型

## ライセンス

MIT
