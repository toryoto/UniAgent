# Contracts Package

スマートコントラクトの開発・デプロイパッケージ。

## デプロイ済みコントラクト

### AgentRegistry (Base Sepolia)

- **Network**: Base Sepolia Testnet (Chain ID: 84532)
- **Block Explorer**: https://sepolia.basescan.org
- **Features**: Agent image URLs supported

### USDC (Base Sepolia) - EIP-3009対応

- **Address**: `0x057E5be041509feC1Ee5e3C7ba60c6D1f04Cd337` (最新デプロイ)
- **Deployer**: `0x25b61126EED206F6470533C073DDC3B4157bb6d1`
- **Block Explorer**: https://sepolia.basescan.org/address/0x057E5be041509feC1Ee5e3C7ba60c6D1f04Cd337

### Sample Agents

1. **FlightFinderPro** - `0x0bdd...b75e` - 0.01 USDC (with image)
2. **HotelBookerPro** - `0x70fc...dd0e` - 0.015 USDC (with image)
3. **TourismGuide** - `0xc1de...b0fc` - 0.02 USDC (with image)

## 構造

```
packages/contracts/
├── contracts/      # Solidityコントラクト
├── scripts/        # デプロイスクリプト
├── test/          # テストファイル
├── hardhat.config.ts
└── package.json
```

## セットアップ

### 環境変数の設定

このディレクトリに`.env`ファイルを作成：

```bash
# .env.exampleをコピー
cp .env.example .env

# .envファイルを編集
# Base Sepolia用
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here  # Basescan API Key (Etherscan API Keyでも可)
```

## コマンド

### 基本コマンド

```bash
# コンパイル
npm run compile

# テスト実行
npm run test

# テストカバレッジ
npx hardhat coverage

# ガス使用量レポート
REPORT_GAS=true npm run test

# デプロイ（Base Sepolia - 推奨）
npm run deploy:base-sepolia

# デプロイ（ETH Sepolia - 非推奨、x402 SDK非対応）
npm run deploy:sepolia
```

### サンプルエージェント登録

```bash
# デプロイ後、サンプルエージェントを登録（Base Sepolia）
AGENT_REGISTRY_ADDRESS=0x... npx hardhat run scripts/register-sample-agents.ts --network base-sepolia

# デプロイ検証（Base Sepolia）
AGENT_REGISTRY_ADDRESS=0x... npx hardhat run scripts/verify-deployment.ts --network base-sepolia
```

### コントラクト検証

```bash
# Basescanでソースコードを検証（Base Sepolia）
# 環境変数にBASESCAN_API_KEYまたはETHERSCAN_API_KEYを設定
BASESCAN_API_KEY=your_api_key npx hardhat verify --network base-sepolia <contract-address>

# Etherscanでソースコードを検証（ETH Sepolia - 非推奨）
ETHERSCAN_API_KEY=your_api_key npx hardhat verify --network sepolia <contract-address>
```

**注意**: Etherscan API V2への移行により、単一のAPIキーを使用するようになりました。Base Sepoliaの場合はBasescan APIキーを推奨します。

## 環境変数

環境変数はルートディレクトリの`.env`ファイルから読み込まれます。
