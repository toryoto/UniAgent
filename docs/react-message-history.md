# ReAct 履歴の復元（メモ）

## 概要

マルチステップの ReAct（モデル → ツール → モデル → ツール …）では、実行時は **ツール呼び出しのたびに別の `AIMessage`** が立ち、各メッセージに **その時点のテキストと `tool_calls`** が載ることが多い。

一方、DB に保存した会話を LangChain に戻す [`agent/src/core/history-to-messages.ts`](../agent/src/core/history-to-messages.ts) では、1 アシスタントターン内の **全 `tool_calls` を 1 つの `AIMessage`（多くは `content: ''`）に束ね**、続けて `ToolMessage` 列、その後 **最後の `AIMessage(entry.content)`** という形で展開している。

この差分に関するコードレビュー指摘は、**メッセージ列の意味論（順次か並列か・どの発話がどのツールに対応するか）** の観点で **妥当** である。

## レビューで問題にされていた点

典型的な順次 ReAct:

1. LLM テキスト → `tool_call` A  
2. `ToolMessage(A.result)`  
3. LLM テキスト → `tool_call` B（**中間の推論テキスト**）  
4. `ToolMessage(B.result)`  
5. 最終テキスト  

復元側が次のようになると、**③のテキストが最初の `AIMessage` の `content` に載らない**ため、モデルから見ると「空の発話で A と B をまとめて出した」ように近づく。

```text
AIMessage({ content: '', tool_calls: [A, B] })
ToolMessage(A)
ToolMessage(B)
AIMessage(⑤の内容のみ、または全文がここに載る設計)
```

複雑なタスクでは、**チェーン上の因果関係の表現が弱まるリスク**がある、というのがレビューの趣旨である。

## 「中間テキストが DB に無い」のか

ストリーミング実装 [`agent/src/core/agent-streaming.ts`](../agent/src/core/agent-streaming.ts) では、`llm_token` により **`ctx.finalResponse` にテキストが連結**され、`final` イベントでクライアント／保存処理に渡される。

そのため **文字列としての発話**は、設計によっては **`Message.content` に時系列で残りうる**。問題の本質は「文字が一切無い」ことより、**LangChain に渡す `BaseMessage[]` の構造**が、実実行時の **メッセージ境界**と一致しにくいこと、特に **どのツールの直前にどのテキストがあったか** を `AIMessage` 単位で表現できない点にある。

## なぜ `history-to-messages.ts` だけの修正では足りないか

永続化用のツールラウンド型 [`AssistantToolRoundPersisted`](../packages/shared/src/types.ts)（Prisma の `tool_rounds` JSON）と、SSE から配列を組み立てる [`web/src/lib/agent/assistant-turn-collector.ts`](../web/src/lib/agent/assistant-turn-collector.ts) は、現状 **各ラウンドの `id` / `name` / `args` / `result`** を中心に持つ。

**「その `tool_call` の直前までのモデルテキスト」** を **ラウンド単位で保持するフィールドが無い** 場合、展開側で `AIMessage` をツールごとに分割しても、**各 `AIMessage` の `content` を正しく埋めるデータが無い**（`entry.content` を機械的に分割するのは一般に不可能）。

したがって、レビューで挙がった **③の位置への復元**は、**永続化フォーマットと収集パイプラインの拡張なしには実現できない**。

## 修正する場合の推奨パッケージ（将来実装用）

1. **データ取得（Web / SSE）**  
   `llm_token` と `tool_call` の順序を追跡し、**各 `tool_call` 直前までにストリームされたテキスト**をそのラウンドに紐づけて `tool_rounds` に保存する。  
   - 例: `AssistantToolRoundPersisted` に `assistantPrefix?: string` のような任意フィールドを追加する。  
   - **同一モデルステップの並列 `tool_calls`** では、先頭ラウンドに共通プレフィックスを載せ、後続は空文字で「前と同じバッチ」とみなすなど、展開側でグルーピングする。

2. **型と検証**  
   `isToolRoundsArray` を、新フィールドが無い **既存行** でも通るように後方互換で定義する。

3. **展開（agent）**  
   `expandHistoryToLangChainMessages` を、概ね  
   `AIMessage(prefix, そのステップの tool_calls)` → `ToolMessage` … を繰り返し、最後に `AIMessage(最終テキスト)`  
   に近づける。  
   UI と二重表示を避けるなら、**中間は `tool_rounds[].assistantPrefix`、最終のみ `content`** のように役割を分ける案が一貫しやすい。

4. **既存データ**  
   `assistantPrefix` の無いメッセージは、従来どおり「1 `AIMessage` に複数 `tool_calls`」へフォールバックする。

## 後回ししてよい条件の目安

- マルチツールの長い会話を **履歴ごとモデルに再投入**する頻度が低い。  
- 上記リスクを **実測**しておらず、優先度が高くない。  

## 関連ファイル

| 役割 | パス |
|------|------|
| 履歴 → LangChain メッセージ | `agent/src/core/history-to-messages.ts` |
| ストリームのトークン・最終文 | `agent/src/core/agent-streaming.ts` |
| ツールラウンド型・履歴エントリ型 | `packages/shared/src/types.ts` |
| SSE → `tool_rounds` 組み立て | `web/src/lib/agent/assistant-turn-collector.ts` |
| アシスタントメッセージ保存 | `web/src/app/api/agent/stream/route.ts`, `web/src/app/api/agent/resume/route.ts` |
