# IPFS / Pinata Research

Pinata gateway: `chocolate-secret-cat-833.mypinata.cloud`

## Pinata にピン留めされているファイル一覧

```bash
curl -s "https://api.pinata.cloud/data/pinList?pageLimit=100" \
  -H "Authorization: Bearer $PINATA_JWT" \
  | jq '.rows[] | {ipfs_pin_hash, metadata_name: .metadata.name, date_pinned}'
```

### IPFS の中身を確認（Pinata Gateway 経由）

```bash
# CID から内容を取得
curl -s "https://chocolate-secret-cat-833.mypinata.cloud/ipfs/QmXXXXX" | jq .

# ipfs:// URI から CID を抽出して確認
CID="QmXXXXX"   # ipfs://QMXXXXX の QMXXXXX 部分
curl -s "https://chocolate-secret-cat-833.mypinata.cloud/ipfs/$CID" | jq .
```

### tokenURI の IPFS を一発で確認（cast + curl のコンボ）

```bash
URI=$(cast call 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92 \
  "tokenURI(uint256)(string)" 27 --rpc-url https://sepolia.base.org)
CID=$(echo $URI | sed 's/ipfs:\/\///' | tr -d '"')
curl -s "https://chocolate-secret-cat-833.mypinata.cloud/ipfs/$CID" | jq '.services[0].endpoint'
```

---

## IPFS ファイルを削除（unpin）

```bash
curl -X DELETE "https://api.pinata.cloud/pinning/unpin/QmXXXXX" \
  -H "Authorization: Bearer $PINATA_JWT"
```

> ピン留めを外してもすぐには消えない（IPFS ネットワーク上にしばらく残る）。
> 削除前に必ずオンチェーンの tokenURI が新しい CID を指しているか確認すること。
