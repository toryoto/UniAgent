---
name: uniagent-agent-registration
description: |
  UniAgent プロジェクトにおける ERC-8004 Agent の IPFS アップロード・オンチェーン登録・リカバリー・リサーチを行うスキル。

  以下のいずれかの場面で積極的に使用すること:
  - "登録して", "IPFSにアップして", "オンチェーン登録", "register"
  - "agentId 確認", "tokenURI 確認", "wallet 設定", "setAgentWallet", "setAgentURI"
  - "IPFSの中身確認", "Pinata", "IPFS ファイル削除", "unpin"
  - 登録に失敗した・wallet が設定されていない・endpoint が localhost になっていた などのリカバリー
  - "どの ID が登録されているか", "wallet が設定されているか" などの状態調査
  - bulk registration の実行・再実行・スキップ設定

  このスキルを使えば、同じミスを繰り返さず、正しい手順でAgent登録フローを実行できる。
---

# UniAgent Agent Registration & IPFS Skill

このスキルは ERC-8004 AgentIdentityRegistry への登録、IPFS メタデータ管理、リカバリー手順をカバーする。

## 重要な定数

| 項目 | 値 |
|------|-----|
| Registry contract | `0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92` |
| Chain | Base Sepolia (84532) |
| Pinata gateway | `chocolate-secret-cat-833.mypinata.cloud` |
| 支払い受取ウォレット | `0x25b61126EED206F6470533C073DDC3B4157bb6d1` |
| デプロイヤーアドレス | `0x25b61126EED206F6470533C073DDC3B4157bb6d1` |

## タスク別クイックリファレンス

| やりたいこと | 参照先 |
|---|---|
| 登録済み AgentID・wallet・URI を調べる | `uniagent-cast` スキル |
| IPFS の中身を確認・削除する | `uniagent-cast` スキル (ipfs-pinata.md) |
| 新規エージェントを登録する（単体） | [registration-flow.md](references/registration-flow.md) |
| バルク登録 (agents.yaml) | [registration-flow.md](references/registration-flow.md) |
| wallet が設定されていないエージェントを修復 | [recovery-playbook.md](references/recovery-playbook.md) |
| IPFS の endpoint が localhost・間違い → 修正 | [recovery-playbook.md](references/recovery-playbook.md) |
| setAgentURI で tokenURI を更新する | [recovery-playbook.md](references/recovery-playbook.md) |

---

## 必須チェックリスト（登録前）

登録スクリプトを実行する前に必ず確認する:

```bash
# 1. BASE_URL が production になっているか確認（localhost は絶対にNG）
grep BASE_URL a2a-agents/.env a2a-agents/flight-agent/.env

# 2. AGENT_RECEIVER_ADDRESS がウォレットアドレスか確認（コントラクトアドレスはNG）
#    正しい値: 0x25b61126EED206F6470533C073DDC3B4157bb6d1
#    誤った例: 0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92  ← これは Registry コントラクト

# 3. production エンドポイントへの疎通確認
curl -s https://YOUR_DOMAIN/health
```

---

## npm workspace 指定の注意

```bash
# ❌ 間違い: パスプレフィックスになり a2a-agents/ 以下の全 workspace が動く
npm run register --workspace=a2a-agents

# ✅ 正しい: パッケージ名で指定
npm run register --workspace=@agent-marketplace/a2a-agents
npm run dev    --workspace=@agent-marketplace/flight-agent
```

---

## よくある失敗パターン

| 症状 | 原因 | 対処 |
|---|---|---|
| `setAgentWallet` が実行されずスキップされた | 以前の ownerOf 検証コードが Infura レート制限でエラー | [recovery-playbook.md](references/recovery-playbook.md) の wallet 修復手順 |
| IPFS の endpoint が `http://localhost:3005` | 登録時に `BASE_URL` が未設定だった | IPFS 再アップロード + `setAgentURI` |
| `AGENT_RECEIVER_ADDRESS` がコントラクトアドレス | `.env` の設定ミス | `0x25b61126EED206F6470533C073DDC3B4157bb6d1` に修正 |
| トークンが存在するのに `ownerOf` がエラー | Infura レート制限（RPC の一時的なエラー） | `cast call ownerOf(N)` で実際のチェーン状態を確認 |
| 重複トークンが作成された | `--workspace=a2a-agents` で意図しない workspace も動いた | 正しいパッケージ名で実行；重複は `burn(agentId)` で削除可能 |
