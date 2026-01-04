# Web Application

Next.js 15とReact 19で構築されたUniAgentのWebアプリケーション。

## 技術スタック

- **Next.js 15** (App Router)
- **React 19**, **Tailwind CSS**
- **Privy** (認証・ウォレット)
- **wagmi**, **ethers.js** (ブロックチェーン)
- **React Query** (状態管理)

## セットアップ

**注意**: このプロジェクトはモノレポ構成です。依存関係のインストールは**ルートディレクトリ**から実行してください。

```bash
# ルートディレクトリから依存関係をインストール
cd ../../
npm install

# 環境変数設定（.env.local.exampleを参照）
cp .env.local.example .env.local
# .env.localを編集

# 開発サーバー起動（ルートまたはwebディレクトリから）
npm run dev --workspace=web
# または
cd web && npm run dev
```

### 環境変数

環境変数の詳細は `.env.local.example` を参照してください。

## 主要機能

- ユーザー認証・ウォレット管理（Privy）
- エージェント検索・マーケットプレイス
- チャットインターフェース（Paygent X連携）
- トランザクション履歴・評価

## コマンド

```bash
# ルートディレクトリから実行（推奨）
npm run dev --workspace=web
npm run build --workspace=web
npm run lint --workspace=web
npm run type-check --workspace=web
npm run dev
npm run build
npm run lint
npm run type-check
```

## データベース管理

### Prismaスキーマの変更をSupabaseに反映

Prismaスキーマ（`prisma/schema.prisma`）を変更した後、以下の手順でデータベースに反映します：

```bash
# webディレクトリに移動
cd web

# 1. データベースにスキーマを反映（開発環境）
npm run db:push

# 2. Prismaクライアントを再生成
npm run db:generate
```

**注意**:

- `DATABASE_URL`と`DIRECT_URL`の環境変数が設定されている必要があります
- 本番環境では`prisma migrate deploy`を使用してください
