# Registration Flow

## 単体エージェント登録（flight-agent など専用スクリプト）

### 前提チェック

```bash
# 1. BASE_URL が production か
grep BASE_URL a2a-agents/flight-agent/.env
# 期待値: BASE_URL=https://search-flight-agent-production.up.railway.app

# 2. エンドポイントの疎通確認
curl -s https://search-flight-agent-production.up.railway.app/health

# 3. AGENT_RECEIVER_ADDRESS がウォレットか（コントラクトアドレスではない）
grep AGENT_RECEIVER_ADDRESS a2a-agents/flight-agent/.env
# 期待値: 0x25b61126EED206F6470533C073DDC3B4157bb6d1
```

### 実行

```bash
# IPFS のみ確認（--dry-run）
cd a2a-agents/flight-agent
npx tsx scripts/register.ts --dry-run

# 本登録（IPFS + オンチェーン）
npx tsx scripts/register.ts
```

### ログの読み方

```
=== Flight Agent Registration ===
IPFS URI: ipfs://QmXXXXX   ← ここを控える
Tx: 0x...                   ← register() の tx hash
Agent ID: 27                ← 割り当てられた tokenId
Agent wallet set            ← setAgentWallet() 成功
```

`Agent ID` が出なかった場合は `cast receipt TX_HASH` でレシートを確認し、Transfer イベント (from=0x0) の tokenId を拾う。

---

## バルク登録（a2a-agents/agents.yaml 全体）

### スキップ設定の確認・変更

```typescript
// a2a-agents/scripts/register-skip-slugs.ts
export const SKIP_BULK_REGISTRATION_SLUGS = new Set([
  'premium-hotel-search',  // 既に登録済み
  'budget-stay-finder',    // 既に登録済み
  // 追加登録をスキップしたい slug をここに追加
]);
```

### 実行

```bash
# ✅ 正しいパッケージ名で指定すること
npm run register --workspace=@agent-marketplace/a2a-agents

# または直接
cd a2a-agents
npx tsx scripts/register-all.ts
```

> ⚠️ `--workspace=a2a-agents` は間違い。パスプレフィックスとして解釈され、
> `a2a-agents/hotel-agent` と `a2a-agents/flight-agent` の register スクリプトも動いてしまう。

### 再登録（メタデータ修正後）

```bash
npm run register-reupload --workspace=@agent-marketplace/a2a-agents
```

### バルク登録の出力例

```
[1/10] PremiumHotelSearch (premium-hotel-search)
  Uploading to IPFS...
  IPFS: ipfs://QmXXX
  Registering on-chain...
  Tx: 0xabc...
  Agent ID: 28
  Setting agent wallet...
  Wallet set
  Done
```

---

## ERC-8004 メタデータ構造

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "AgentName",
  "description": "説明",
  "image": "https://via.placeholder.com/150/XXXXXX/ffffff?text=Slug",
  "services": [
    {
      "name": "A2A",
      "endpoint": "https://PRODUCTION_DOMAIN/slug/.well-known/agent.json",
      "version": "1.0.0",
      "skills": [{"id": "...", "name": "...", "description": "..."}],
      "domains": ["travel"]
    }
  ],
  "x402Support": true,
  "active": true,
  "category": "travel"
}
```

**絶対に localhost をエンドポイントに入れないこと。** `BASE_URL` 環境変数が production を指しているかを必ず確認する。

---

## viem コードで createPublicClient を使う場合の注意

```typescript
// ❌ chain 指定なし → ネットワーク判定がおかしくなることがある
const publicClient = createPublicClient({ transport: http(RPC_URL) });

// ✅ 必ず chain: baseSepolia を指定
import { baseSepolia } from 'viem/chains';
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(RPC_URL || undefined),
});
```

---

## Pinata への IPFS アップロード（curl）

```bash
curl -s -X POST "https://api.pinata.cloud/pinning/pinJSONToIPFS" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PINATA_JWT" \
  -d '{
    "pinataContent": { ...metadata... },
    "pinataMetadata": { "name": "agent-name-registration" }
  }' | jq '.IpfsHash'
```

返り値の `IpfsHash` が CID。オンチェーンには `"ipfs://"+CID` で渡す。
