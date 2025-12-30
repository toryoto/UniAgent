# Agent Marketplace

A2A、x402、ブロックチェーンを融合した AI エージェント向け分散型マーケットプレイス。

## デプロイ情報

### AgentRegistry Contract (Base Sepolia)

- **Network**: Base Sepolia Testnet (Chain ID: 84532)
- **Address**: `0xe2B64700330af9e408ACb3A04a827045673311C1` (最新デプロイ)
- **Deployer**: `0x25b61126EED206F6470533C073DDC3B4157bb6d1`
- **Block Explorer**: https://sepolia.basescan.org/address/0xe2B64700330af9e408ACb3A04a827045673311C1

> **注意**: x402 SDKがBase Sepoliaをサポートしているため、ETH Sepoliaから移行しました。

### 旧デプロイ (ETH Sepolia) - 非推奨

- **Network**: Sepolia Testnet
- **Address**: `0x1a4Ec58FE22aFe2624eaE8B5085aeBf85BCEB4e3`
- **Etherscan**: https://sepolia.etherscan.io/address/0x1a4Ec58FE22aFe2624eaE8B5085aeBf85BCEB4e3

### Registered Sample Agents (with images)

#### 1. FlightFinderPro

- **Agent ID**: `0x0bddd164b1ba44c2b7bd2960cce576de2de93bd1da0b5621d6b8ffcffa91b75e`
- **Category**: travel
- **Price**: 0.01 USDC per call
- **Description**: 最安値フライト検索エージェント
- **Image**: Blue placeholder

#### 2. HotelBookerPro

- **Agent ID**: `0x70fc477d5b587eed5078b44c890bae89e6497d5b1b9e115074eddbb3eb46dd0e`
- **Category**: travel
- **Price**: 0.015 USDC per call
- **Description**: ホテル予約エージェント
- **Image**: Red placeholder

#### 3. TourismGuide

- **Agent ID**: `0xc1de1b2fcec91001afacbf4acc007ff0b96e84c2f9c7ca785cba05102234b0fc`
- **Category**: travel
- **Price**: 0.02 USDC per call
- **Description**: 観光ガイドエージェント
- **Image**: Green placeholder

## 技術スタック

- **ブロックチェーン**: Solidity, Base Sepolia
- **開発環境**: Hardhat, TypeScript
- **フロントエンド/バックエンド**: Next.js (App Router)
- **認証/ウォレット**: Privy
- **エージェント実行**: Claude API + MCP (fastMCP)

## プロジェクト構成

このプロジェクトは**モノレポ構成**です：

- `contracts/`: スマートコントラクト（独立した Hardhat プロジェクト）
- `web/`: Next.js アプリケーション（独立した Next.js プロジェクト）
- ルート: npm workspaces で各プロジェクトを管理

各プロジェクトは独立した`package.json`を持ちますが、依存関係は **npm workspaces** により
原則として **ルートの `package-lock.json` に集約**して管理します（CIもこの前提です）。

重要: **`web/` や `contracts/` 配下で `npm install` / `npm ci` を実行しないでください**。
（サブディレクトリに `package-lock.json` が生成され、ロックファイルが二重管理になって混乱します）

## セットアップ

### ルートから一括セットアップ（推奨）

```bash
# 全依存関係のインストール
npm install

# 開発サーバー起動（web）
npm run dev

# 全プロジェクトのビルド
npm run build

# コードフォーマット
npm run format

# フォーマットチェック
npm run format:check

# Lint（全プロジェクト）
npm run lint

# Lint 自動修正
npm run lint:fix

# 型チェック（全プロジェクト）
npm run type-check

# テスト（全プロジェクト）
npm run test
```

### 個別プロジェクトのセットアップ

#### 1. コントラクト開発

```bash
cd contracts

# 環境変数の設定
cp .env.example .env
# .envを編集

# コンパイル
npm run compile

# テスト
npm run test

# デプロイ（Base Sepolia - 推奨）
npm run deploy:base-sepolia

# デプロイ（ETH Sepolia - 非推奨、x402 SDK非対応）
npm run deploy:sepolia
```

#### 2. Web 開発

```bash
cd web

# 開発サーバー起動
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# Lint 自動修正
npm run lint:fix

# 型チェック
npm run type-check
```

補足: 上の「個別」コマンドはディレクトリ移動後に実行していますが、依存関係のインストール自体は
**ルートで `npm install` / `npm ci` を実行**する運用を推奨します。

## プロジェクト構造

```
.
├── contracts/         # Hardhatプロジェクト（独立）
│   ├── contracts/     # Solidityコントラクト
│   ├── scripts/       # デプロイスクリプト
│   ├── test/          # テストファイル
│   ├── package.json
│   └── .env
├── web/              # Next.jsプロジェクト（独立、今後追加）
│   ├── app/
│   ├── components/
│   ├── package.json
│   └── .env.local
└── spec/             # 仕様書
```

## メリット

- ✅ **シンプル**: 各プロジェクトが完全に独立
- ✅ **依存関係の分離**: バージョン衝突なし
- ✅ **デプロイが簡単**: Vercel は`web/`のみをデプロイ
- ✅ **開発環境の独立**: コントラクトとフロントを別々に開発
- ✅ **一括管理**: ルートから全プロジェクトのコマンドを実行可能
