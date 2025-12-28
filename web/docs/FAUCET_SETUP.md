# Faucet API Setup

## 概要

Faucetページでは、ユーザーのウォレットアドレスに対して自動的にETHとUSDCを送信するAPIを使用します。

## 環境変数の設定

`.env.local` に以下の環境変数を追加してください：

```bash
# Faucet API Endpoints
FAUCET_ETH_API_URL=https://your-faucet-api.com/eth
FAUCET_USDC_API_URL=https://your-faucet-api.com/usdc

# Optional: API Key for authentication
FAUCET_API_KEY=your_api_key_here
```

## Faucet API の要件

### リクエスト形式

両方のエンドポイントは以下の形式でリクエストを受け付ける必要があります：

```json
{
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "amount": "0.1"  // ETHの場合は "0.1"、USDCの場合は "100"
}
```

### レスポンス形式

成功時（200 OK）：

```json
{
  "success": true,
  "message": "Successfully sent tokens",
  "txHash": "0x1234567890abcdef...",
  "amount": "0.1",
  "address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

エラー時（4xx, 5xx）：

```json
{
  "error": "Error message here",
  "message": "Detailed error description"
}
```

## API実装例

### 推奨される実装

1. **レート制限**: 1つのアドレスにつき24時間に1回まで
2. **金額制限**: 
   - ETH: 0.1 - 0.5 SEP ETH
   - USDC: 100 - 1000 USDC
3. **認証**: APIキーまたはJWT認証
4. **ログ**: リクエストログを記録

### セキュリティ考慮事項

- ✅ レート制限を実装（同じアドレスへの連続リクエストを防ぐ）
- ✅ IPアドレスベースの制限
- ✅ トランザクションの監視
- ✅ エラーハンドリング

## ローカル開発用のモックAPI

開発環境でFaucet APIがまだない場合、モックレスポンスを返すように設定できます：

`/web/src/app/api/faucet/eth/route.ts` を以下のように変更：

```typescript
export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Mock response for development
    if (process.env.NODE_ENV === 'development') {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate delay
      
      return NextResponse.json({
        success: true,
        message: `Successfully sent 0.1 ETH to ${address}`,
        txHash: '0x' + Math.random().toString(16).substring(2),
        amount: '0.1',
        address,
      });
    }

    // Production code...
  } catch (error) {
    // Error handling...
  }
}
```

## Faucet UIの動作

### フロー

1. ユーザーがFaucetページにアクセス
2. 接続中のウォレットアドレスが自動的に表示される
3. "Request ETH" または "Request USDC" ボタンをクリック
4. バックエンドAPIがFaucet APIにリクエストを送信
5. 成功/失敗のメッセージが表示される

### 状態管理

- `idle`: 初期状態
- `loading`: リクエスト送信中
- `success`: トークン送信成功
- `error`: エラー発生

### エラーハンドリング

以下のエラーケースに対応：
- ウォレット未接続
- API設定未完了
- レート制限超過
- ネットワークエラー
- サーバーエラー

## テスト方法

### 1. モックモードでテスト

```bash
cd web
npm run dev
```

ブラウザで http://localhost:3000/faucet にアクセスし、ボタンをクリック

### 2. 実際のAPI接続テスト

`.env.local` に実際のFaucet APIのURLを設定：

```bash
FAUCET_ETH_API_URL=https://your-api.com/faucet/eth
FAUCET_USDC_API_URL=https://your-api.com/faucet/usdc
```

開発サーバーを再起動して動作確認

### 3. cURLでのテスト

```bash
# ETH Faucet
curl -X POST http://localhost:3000/api/faucet/eth \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'

# USDC Faucet
curl -X POST http://localhost:3000/api/faucet/usdc \
  -H "Content-Type: application/json" \
  -d '{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```

## トラブルシューティング

### "Faucet API not configured" エラー

**原因**: 環境変数が設定されていない

**解決策**:
```bash
# .env.local に追加
FAUCET_ETH_API_URL=https://your-api.com/eth
FAUCET_USDC_API_URL=https://your-api.com/usdc
```

### "Network error. Please try again." エラー

**原因**: Faucet APIにアクセスできない

**確認事項**:
1. Faucet APIが起動しているか
2. URLが正しいか
3. CORSの設定が正しいか
4. ファイアウォールでブロックされていないか

### ボタンが無効になっている

**原因**: ウォレットが接続されていない

**解決策**: Privyでログインしてウォレットを接続

## 本番環境での推奨事項

1. **HTTPS必須**: Faucet APIはHTTPSで提供
2. **認証**: APIキーまたはJWT認証を実装
3. **レート制限**: Cloudflare等でレート制限を設定
4. **監視**: ログとメトリクスを記録
5. **アラート**: 異常なトラフィックを検知

## 参考リンク

- [Privy Documentation](https://docs.privy.io/)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Ethereum Sepolia Faucet List](https://faucetlink.to/sepolia)

