# AgentIdentityRegistry 再デプロイ ランブック

コントラクトを変更・再デプロイした際に実行する手順書。  
直近の変更: `burn(uint256 agentId)` 関数を追加（v2）

---

## 前提条件

- `.env` に `PRIVATE_KEY`、`RPC_URL`（Base Sepolia）、`PINATA_JWT` が設定済み
- `npm install` 実施済み（リポジトリルートで）
- Hardhat、tsx、cast（Foundry）が使用可能

---

## Phase 1: コントラクト

```bash
cd contracts

# 1. テスト（必須）
npx hardhat test

# 2. Base Sepolia にデプロイ
npx hardhat run scripts/deploy-identity-registry.ts --network base-sepolia
# → "AgentIdentityRegistry deployed to: 0xNEW..." が出力される

# 3. Basescan で検証（任意だが推奨）
npx hardhat verify --network base-sepolia 0xNEW...
```

---

## Phase 2: ABI ファイルの更新

`burn` など関数を追加した場合は ABI を shared に反映する。

```bash
cp contracts/artifacts/contracts/AgentIdentityRegistry.sol/AgentIdentityRegistry.json \
   packages/shared/src/AgentIdentityRegistry.json

npm run build --workspace=packages/shared
```

---

## Phase 3: アドレス更新（7 箇所）

### 3-1. packages/shared（デフォルト値）

`packages/shared/src/config.ts` の `DEFAULT_CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY` を新アドレスに変更。

### 3-2. CLAUDE.md

`contracts/` セクションの `AgentIdentityRegistry` アドレス欄を更新。

### 3-3. 環境変数（Railway / Vercel）

| サービス | 変数名 |
|---|---|
| web (Railway または Vercel) | `AGENT_IDENTITY_REGISTRY` |
| web (Railway または Vercel) | `NEXT_PUBLIC_AGENT_IDENTITY_REGISTRY` |

### 3-4. AgentStaking の再デプロイ（コンストラクタ引数が変わるため）

```bash
REGISTRY_ADDRESS=0xNEW... npx hardhat run scripts/deploy-staking.ts --network base-sepolia
```

---

## Phase 4: DB のクリア

新コントラクトは agentId が 1 から振り直しになるため、既存行との衝突を防ぐ。

```sql
-- Supabase Studio / psql で実行
TRUNCATE agent_cache CASCADE;
TRUNCATE agent_stakes CASCADE;
-- eas_attestations に tokenId 参照がある場合も同様
```

---

## Phase 5: ダミー Agent 一括登録

```bash
cd a2a-agents

# agents.yaml の全エントリを IPFS アップロード → on-chain register → setAgentWallet
npx tsx scripts/register-all.ts

# 失敗したエントリだけ再実行したい場合
npx tsx scripts/register-reupload.ts
```

登録完了後、agentId の一覧を確認：

```bash
cast call 0xNEW... "getAllAgentIds()(uint256[])" --rpc-url https://sepolia.base.org
```

---

## Phase 6: Hotel Search Agent 登録

```bash
# a2a-agents/hotel-agent/.env を確認
# BASE_URL が Railway ドメインを指していること
# AGENT_RECEIVER_ADDRESS が設定されていること

npm run register --workspace=@agent-marketplace/hotel-agent
# → "Agent ID: XX" が出力される
```

登録後に agentWallet が設定されているか確認：

```bash
cast call 0xNEW... "getAgentWallet(uint256)(address)" XX --rpc-url https://sepolia.base.org
```

---

## Phase 7: Alchemy Webhook の更新

1. Alchemy ダッシュボードで既存 webhook を開く
2. 監視対象コントラクトアドレスを `0xNEW...` に変更
3. `web/src/app/api/webhooks/alchemy/route.ts` 内にハードコードされたアドレスがあれば更新

---

## Phase 8: 動作確認

```bash
# Hotel Agent のエンドポイント確認
curl https://search-hotel-agent-production.up.railway.app/hotel-agent/.well-known/agent.json

# Web UI 起動してマーケットプレイスに Agent が表示されるか確認
npm run dev
```

---

## トラブルシューティング

### `ownerOf` が直後に reverts する

Base Sepolia の RPC ロードバランシングによる同期遅延。  
登録スクリプトでは `ownerOf` 検証を行わず、`setAgentWallet` を直接呼ぶ設計にしてある（`register.ts` 修正済み）。

### `ERC721NonexistentToken` on burn

対象トークンが既に burn 済み、または存在しない agentId を指定している。  
`getAllAgentIds()` で現在の有効な ID 一覧を確認すること。

### `npm run register-all` が途中で止まる

`register-skip-slugs.ts` で処理済みの slug をスキップしてから `register-all.ts` を再実行する。
