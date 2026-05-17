# AgentRegistry Contract

AgentCardを管理するオンチェーンレジストリコントラクト。

## 機能概要

### 1. AgentCard登録・管理

- `registerAgent`: 新しいAgentCardを登録
- `updateAgent`: AgentCard情報を更新（ownerのみ）
- `activateAgent` / `deactivateAgent`: エージェントの有効/無効化

### 2. 検索機能

- `getAgentCard`: 単一のAgentCardを取得
- `getAllAgentIds`: 全AgentCardのIDを取得
- `getAgentsByCategory`: カテゴリで検索
- `getActiveAgentsByCategory`: アクティブなエージェントをカテゴリで検索

### 3. Transaction記録

- `recordTransaction`: 使用履歴を記録（評価なし）
- `updateTransactionRating`: 既存トランザクションの評価を追加/更新

### 4. 評価システム

- 5段階評価（1-5）をサポート
- `totalRatings`と`ratingCount`で平均評価を計算
- `getAverageRating`: 平均評価を取得（100倍の値、例: 450 = 4.50）

## データ構造

### AgentCard

- A2A標準フィールド: agentId, name, description, url, version, defaultInputModes, defaultOutputModes, skills
- ブロックチェーン拡張: owner, isActive, createdAt
- 評価システム: totalRatings, ratingCount
- x402決済情報: PaymentInfo
- カテゴリ: category

### PaymentInfo

- tokenAddress: USDCコントラクトアドレス
- receiverAddress: エージェントの受取アドレス
- pricePerCall: 1回あたりの価格（6 decimals）
- chain: チェーン名（"base"など）

### Transaction

- txId: トランザクションID
- agentId: エージェントID
- caller: 呼び出し元アドレス
- rating: 評価（1-5、0は未評価）
- amount: 支払額
- timestamp: タイムスタンプ

## イベント

- `AgentRegistered`: エージェント登録時
- `AgentUpdated`: エージェント更新時
- `AgentActivated` / `AgentDeactivated`: エージェント有効/無効化時
- `TransactionRecorded`: トランザクション記録時
- `RatingUpdated`: 評価更新時

## 使用例

### エージェント登録

```solidity
Skill[] memory skills = new Skill[](2);
skills[0] = Skill("search-flights", "Flight Search", "2地点間のフライトを検索");
skills[1] = Skill("compare-prices", "Price Comparison", "複数航空会社の価格比較");

PaymentInfo memory payment = PaymentInfo({
    tokenAddress: 0x7F594ABa4E1B6e137606a8fBAb5387B90C8DEEa9, // Custom USDC
    receiverAddress: 0xABCDEF1234567890...,
    pricePerCall: 10000, // 0.01 USDC (6 decimals)
    chain: "sepolia"
});

string[] memory inputModes = new string[](1);
inputModes[0] = "text/plain";

string[] memory outputModes = new string[](1);
outputModes[0] = "application/json";

registry.registerAgent(
    keccak256("ExampleFlightAgent"),
    "ExampleFlightAgent",
    "最安値フライト検索エージェント",
    "https://flight-agent.example.com",
    "1.0.0",
    inputModes,
    outputModes,
    skills,
    payment,
    "travel"
);
```

### トランザクション記録と評価

```solidity
// 使用履歴を記録（評価なし）
registry.recordTransaction(
    keccak256("tx-123"),
    agentId,
    10000 // amount: 0.01 USDC
);

// 後でユーザーが評価を追加
registry.updateTransactionRating(keccak256("tx-123"), 5);
```

## 注意事項

- `agentId`は`bytes32`型（通常は`keccak256`ハッシュを使用）
- 評価は1-5の範囲で指定
- `pricePerCall`は6 decimals（USDCの場合）
- オーナーのみがエージェント情報を更新可能
- トランザクションの評価は呼び出し元のみが更新可能
