# Smart Contracts

UniAgent のスマートコントラクト（Hardhat）。

## デプロイ済みコントラクト

**Network**: Base Sepolia (Chain ID: 84532)

### AgentIdentityRegistry (ERC-8004)

エージェント identity のオンチェーン管理（ERC-721 ベース、[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) 準拠）。

- **Address**: `0x28E0346B623C80Fc425E85339310fe09B79012Cd`
- **Explorer**: https://sepolia.basescan.org/address/0x28E0346B623C80Fc425E85339310fe09B79012Cd

### USDC (Base Sepolia)

x402 決済で使用。[EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) 対応。

- **Address**: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`

### EAS Agent Evaluation Schema

エージェント評価用 [EAS](https://easscan.org/) スキーマ（オフチェーン attestation 用）。

- **Schema UID**: `0xfc26bef12f3b12b03dce76761bf0c23ae5ee4370f86132b2d69369cdfd208748`
- **View**: https://base-sepolia.easscan.org/schema/view/0xfc26bef12f3b12b03dce76761bf0c23ae5ee4370f86132b2d69369cdfd208748
- **Schema**: `uint256 agentId, bytes32 paymentTx, uint256 chainId, uint8 quality, uint8 reliability, uint32 latency, uint64 timestamp, string[] tags`

---

**deprecated**: AgentRegistry (`0xe2B64700330af9e408ACb3A04a827045673311C1`) は現在未使用です。

## セットアップ

**注意**: このプロジェクトはモノレポ構成です。依存関係のインストールは**ルートディレクトリ**から実行してください。

```bash
# ルートディレクトリから依存関係をインストール
npm install

# 環境変数設定
cp .env.example .env
# .env を編集（PRIVATE_KEY 等）
```

### 環境変数

`.env.example` を参照してください。主に以下が必要です。

- `PRIVATE_KEY` - 署名・デプロイ用
- `BASE_SEPOLIA_RPC_URL` - 省略時は https://sepolia.base.org
- ERC-8004 登録用: `PINATA_JWT`, `PINATA_GATEWAY_URL`（任意）

## コマンド

```bash
# ルートディレクトリから実行（推奨）
npm run compile --workspace=contracts
npm run test --workspace=contracts
npm run deploy:base-sepolia --workspace=contracts

# contracts ディレクトリ内から実行
cd contracts
npm run compile
npm run test
npm run deploy:base-sepolia
```

### ERC-8004 / AgentIdentityRegistry

```bash
cd contracts

# AgentIdentityRegistry のデプロイ
npx hardhat run scripts/deploy-identity-registry.ts --network base-sepolia

# サンプルエージェントの登録
npx hardhat run scripts/register-agents-erc8004.ts --network base-sepolia

# オンチェーン状態の確認
npx hardhat run scripts/inspect-identity-registry.ts --network base-sepolia
```

### EAS スキーマ登録

```bash
cd contracts

# Agent 評価用 EAS スキーマを Base Sepolia に登録（1回のみ）
npx hardhat run scripts/register-eas-agent-evaluation-schema.ts --network base-sepolia
```

## 主要スクリプト

| スクリプト | 説明 |
|-----------|------|
| `deploy-identity-registry.ts` | AgentIdentityRegistry (ERC-8004) のデプロイ |
| `register-agents-erc8004.ts` | ERC-8004 準拠サンプルエージェントの登録 |
| `inspect-identity-registry.ts` | AgentIdentityRegistry のオンチェーン状態確認 |
| `register-eas-agent-evaluation-schema.ts` | EAS Agent 評価スキーマの登録 |
| `update-agent-urls.ts` | 登録済みエージェントの URL 更新 |
| `deploy.ts` | AgentRegistry のデプロイ（deprecated） |
| `deploy-usdc.ts` | USDC デプロイ |
| `verify-deployment.ts` | デプロイ検証 |
