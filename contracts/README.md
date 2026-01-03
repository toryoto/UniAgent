# Smart Contracts

UniAgentのスマートコントラクト（Hardhat）。

## デプロイ済みコントラクト

### AgentRegistry (Base Sepolia)

- **Address**: `0xe2B64700330af9e408ACb3A04a827045673311C1`
- **Network**: Base Sepolia (Chain ID: 84532)
- **Explorer**: https://sepolia.basescan.org/address/0xe2B64700330af9e408ACb3A04a827045673311C1

### USDC (Base Sepolia)

- **Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

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

## コマンド

```bash
# ルートディレクトリから実行（推奨）
npm run compile --workspace=contracts
npm run test --workspace=contracts
npm run deploy:base-sepolia --workspace=contracts

# または、contractsディレクトリ内から実行
cd contracts
npm run compile
npm run test
npm run deploy:base-sepolia
```

## 主要スクリプト

- `scripts/deploy.ts`: コントラクトデプロイ
- `scripts/register-sample-agents.ts`: サンプルエージェント登録
- `scripts/verify-deployment.ts`: デプロイ検証
