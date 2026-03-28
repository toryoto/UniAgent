# AgentIdentityRegistry / AgentStaking 再デプロイ手順

Base Sepolia（Chain ID: 84532）を想定。`AgentStaking` はコンストラクタで `IERC721 registry` が **immutable** のため、**新しいレジストリに切り替える場合は AgentStaking も新規デプロイ**する（旧 Staking は旧レジストリを参照し続ける）。

## 前提

- ルートで `npm install` 済み（サブワークスペース単体での `npm install` はしない）
- `contracts/.env` にデプロイ用秘密鍵・RPC 等が設定されている（Hardhat の `base-sepolia` 用）
- テストネットの ETH がデプロイアカウントにある

## 推奨の実行順序

1. コントラクトのコンパイル・テスト（任意だが推奨）
2. **AgentIdentityRegistry** をデプロイし、アドレスを控える
3. **DB の整理**（`agent_id` は tokenId のみの PK のため、旧レジストリの行が残ると tokenId の意味がずれる）
4. **環境変数**を新アドレスに更新（Vercel / Railway / ローカル）
5. **AgentStaking** をデプロイ（`REGISTRY_ADDRESS` に手順 2 のアドレスを指定）
6. **Staking 用の環境変数**を更新
7. **Alchemy Webhook** の監視コントラクトを新アドレスに合わせる
8. エージェントの **オンチェーン再登録**（IPFS + `register` + `setAgentWallet`）
9. （コントラクト ABI を変えた場合）`packages/shared` へアーティファクト同期と再ビルド

以下、コマンド中心で記載する。

---

## 1. コンパイルとテスト

```bash
cd contracts
npm run compile
npm run test
```

---

## 2. AgentIdentityRegistry のデプロイ

```bash
cd contracts
npx hardhat run scripts/deploy-identity-registry.ts --network base-sepolia
```

出力に表示された **レジストリアドレス**をメモする。`deployments/identity-registry-*.json` にも保存される。

### 検証（任意）

```bash
npx hardhat verify --network base-sepolia <REGISTRY_ADDRESS>
```

---

## 3. データベース（Supabase / Postgres）

**`agent_cache`・`agent_stakes`・`eas_attestations`** など、`agent_id` がオンチェーンの tokenId の文字列のみでコントラクトアドレスと紐づいていないテーブルは、新レジストリでは tokenId が 1 から振り直されるため、**切り替え前に truncate または整合する移行**を行う。

具体的な SQL は運用ポリシーに合わせて実行する（例: 該当テーブルの `TRUNCATE`）。

---

## 4. 環境変数の更新

`@agent-marketplace/shared` の [`packages/shared/src/config.ts`](../packages/shared/src/config.ts) は、次の環境変数が **設定されていればデフォルトアドレスを上書き**する。

| 用途 | 変数名 |
|------|--------|
| サーバー / CLI | `AGENT_IDENTITY_REGISTRY` |
| Next.js（クライアント含む） | `NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY` |

**更新するデプロイ先の例:**

- **web**（Vercel 等）: 上記 `NEXT_PUBLIC_*` と、Webhook 用の既存キー
- **mcp / agent / a2a-agents**（Railway 等）: `AGENT_IDENTITY_REGISTRY`、必要なら `RPC_URL`

ローカルでは各ワークスペースの `.env` を編集する。

---

## 5. AgentStaking のデプロイ

`REGISTRY_ADDRESS` には **手順 2 でデプロイした新レジストリ**を必ず指定する。

```bash
cd contracts
export REGISTRY_ADDRESS=<新しい_AgentIdentityRegistry_アドレス>
# 省略時はスクリプト内の Base Sepolia 既知値が使われるため、再デプロイ時は必ず REGISTRY_ADDRESS を明示すること
export USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e   # Base Sepolia USDC（変更なければこのまま）
export TREASURY_ADDRESS=<トレジャリーアドレス>   # 省略時はデプロイアカウント

npx hardhat run scripts/deploy-staking.ts --network base-sepolia
```

出力の **Staking アドレス**をメモする。

### Staking 用の環境変数

| サーバー / CLI | Next.js |
|----------------|---------|
| `AGENT_STAKING` | `NEXT_PUBLIC_AGENT_STAKING` |

### 検証（任意）

```bash
npx hardhat verify --network base-sepolia <STAKING_ADDRESS> \
  "<USDC_ADDRESS>" "<REGISTRY_ADDRESS>" "<TREASURY_ADDRESS>"
```

---

## 6. Alchemy Webhook

ダッシュボードで、**AgentIdentityRegistry** および **AgentStaking** のカスタム Webhook が参照するコントラクトアドレスを、新デプロイの値に更新する。

アプリ側の署名検証キー（`ALCHEMY_WEBHOOK_SIGNING_KEY` 等）は既存のままでよいが、Webhook を作り直した場合は env も合わせる。

---

## 7. エージェントの再オンチェーン登録

ホテル A2A エージェント一括登録（IPFS → `register` → `setAgentWallet`）:

```bash
# ルートから
npm run register-bulk --workspace=@agent-marketplace/a2a-agents
```

事前に `a2a-agents/.env` に `PRIVATE_KEY`、`RPC_URL` / `NEXT_PUBLIC_RPC_URL`、`BASE_URL`、`AGENT_RECEIVER_ADDRESS` 等を設定する。ドライラン:

```bash
cd a2a-agents
npx tsx scripts/register-all.ts --dry-run
```

別経路でサンプルだけ登録する場合（Hardhat）:

```bash
cd contracts
npx hardhat run scripts/register-agents-erc8004.ts --network base-sepolia
```

（スクリプト内のレジストリアドレスが共有設定と一致していることを確認すること。）

---

## 8. コントラクト ABI を変更した場合

Solidity を変えたあとは、共有パッケージの JSON を同期する。

```bash
cd contracts
npx hardhat compile
cp artifacts/contracts/AgentIdentityRegistry.sol/AgentIdentityRegistry.json ../packages/shared/src/AgentIdentityRegistry.json
# AgentStaking を変えた場合は同様に AgentStaking.json
```

その後、モノレポのビルド・デプロイをやり直す。

```bash
cd /path/to/UniAgent
npm run build
```

---

## 9. オンチェーン確認

```bash
cd contracts
export AGENT_IDENTITY_REGISTRY_ADDRESS=<新レジストリアドレス>
npx hardhat run scripts/inspect-identity-registry.ts --network base-sepolia
```

---

## チェックリスト（短縮）

- [ ] `deploy-identity-registry.ts` 実行 → レジストリアドレス確定
- [ ] DB: `agent_cache` / `agent_stakes` / `eas_attestations` 等を truncate または移行
- [ ] 全サービスの env: `AGENT_IDENTITY_REGISTRY` / `NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY`
- [ ] `REGISTRY_ADDRESS` 指定で `deploy-staking.ts` 実行 → Staking アドレス確定
- [ ] env: `AGENT_STAKING` / `NEXT_PUBLIC_AGENT_STAKING`
- [ ] Alchemy Webhook のコントラクトアドレス更新
- [ ] `register-bulk`（または同等）でエージェント再登録
- [ ] ABI 変更時は `packages/shared` へコピー＋ビルド
