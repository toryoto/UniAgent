# Recovery Playbook

## ケース1: agentWallet が設定されていないトークンを修復

### 症状
- `getAgentWallet(agentId)` が `0x0000000000000000000000000000000000000000` を返す
- バルク登録ログで "Setting agent wallet..." が出ずに終わっていた

### 対処
既存スクリプト `set-wallets-for-ids.ts` を使う:

```bash
cd a2a-agents

# 単体
WALLET_ADDRESS=0x25b61126EED206F6470533C073DDC3B4157bb6d1 \
  npx tsx scripts/set-wallets-for-ids.ts 27

# 範囲指定
WALLET_ADDRESS=0x25b61126EED206F6470533C073DDC3B4157bb6d1 \
  npx tsx scripts/set-wallets-for-ids.ts 1-22 25-55

# 既に設定済みの ID は自動スキップ（冪等性あり）
```

`.env` に `AGENT_RECEIVER_ADDRESS=0x25b61126EED206F6470533C073DDC3B4157bb6d1` があれば `WALLET_ADDRESS` 省略可。

---

## ケース2: IPFS の endpoint が localhost になっている

### 症状
- `tokenURI(agentId)` の中身を確認すると `"endpoint": "http://localhost:3005/..."` になっている
- エージェントが discovery されても実際には到達できない

### 手順

1. **production エンドポイントへの疎通確認**
   ```bash
   curl -s https://YOUR_PRODUCTION_DOMAIN/health
   ```

2. **.env の BASE_URL を修正**
   ```
   BASE_URL=https://YOUR_PRODUCTION_DOMAIN
   ```

3. **新しい IPFS メタデータをアップロード**
   ```bash
   # agents.yaml から slug を特定して update-agent-uri を使う
   BASE_URL=https://YOUR_PRODUCTION_DOMAIN \
     npx tsx scripts/update-agent-uri.ts your-agent-slug AGENT_ID

   # または flight-agent のように専用スクリプトがある場合
   npx tsx a2a-agents/flight-agent/scripts/register.ts --dry-run
   # → 表示される新 IPFS URI を控えて手動で setAgentURI
   ```

4. **オンチェーンの tokenURI を更新**
   ```bash
   # viem で実行（scripts/update-agent-uri.ts で自動化済み）
   # cast で直接実行する場合:
   cast send 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
     "setAgentURI(uint256,string)" AGENT_ID "ipfs://NEW_CID" \
     --private-key $PRIVATE_KEY \
     --rpc-url https://sepolia.base.org
   ```

5. **古い IPFS を削除（unpin）**
   ```bash
   curl -X DELETE "https://api.pinata.cloud/pinning/unpin/OLD_CID" \
     -H "Authorization: Bearer $PINATA_JWT"
   ```

6. **更新を確認**
   ```bash
   NEW_URI=$(cast call 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
     "tokenURI(uint256)(string)" AGENT_ID --rpc-url https://sepolia.base.org)
   NEW_CID=$(echo $NEW_URI | sed 's/ipfs:\/\///' | tr -d '"')
   curl -s "https://chocolate-secret-cat-833.mypinata.cloud/ipfs/$NEW_CID" | jq '.services[0].endpoint'
   ```

---

## ケース3: AGENT_RECEIVER_ADDRESS がコントラクトアドレスだった

### 症状
- `.env` の `AGENT_RECEIVER_ADDRESS` が `0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92`（Registry コントラクト）
- x402 支払いが受け取れない

### 対処
```bash
# .env を修正
AGENT_RECEIVER_ADDRESS=0x25b61126EED206F6470533C073DDC3B4157bb6d1

# 既に登録済みのエージェントに遡って wallet を設定
cd a2a-agents
WALLET_ADDRESS=0x25b61126EED206F6470533C073DDC3B4157bb6d1 \
  npx tsx scripts/set-wallets-for-ids.ts 1-55
```

---

## ケース4: 重複トークンを削除（burn）

### 症状
- 同じエージェントが複数の agentId で登録されている（例: ID 23 と 24 が同じ hotel-agent）
- バルク登録が誤った workspace で二重実行された

### 確認
```bash
# 同じ IPFS URI を持つ ID を探す
for i in $(seq 1 60); do
  uri=$(cast call 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
    "tokenURI(uint256)(string)" $i --rpc-url https://sepolia.base.org 2>/dev/null)
  echo "ID $i: $uri"
done | sort -t: -k2
```

### 削除（owner のみ実行可能）
```bash
cast send 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
  "burn(uint256)" DUPLICATE_ID \
  --private-key $PRIVATE_KEY \
  --rpc-url https://sepolia.base.org
```

> ⚠️ burn は不可逆。canonical ID（小さい方や wallet 設定済みの方）を残し、
> 不要な方（wallet 未設定・IPFS が古い方）を削除する。

---

## ケース5: register tx が reverted した

```bash
# tx の状態確認
cast receipt TX_HASH --rpc-url https://sepolia.base.org

# よくある原因:
# - ガス不足（Base Sepolia では通常 gasLimit 自動計算で十分）
# - Registry がポーズされている → ownerOf(1) などで確認
# - 既に同じ URI で登録済み（Registry 側で revert する実装の場合）
```

---

## ケース6: setAgentURI が reverted した

```bash
# owner かどうか確認
cast call 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
  "ownerOf(uint256)(address)" AGENT_ID --rpc-url https://sepolia.base.org
# → 自分のアドレスでなければ setAgentURI は呼べない
```
