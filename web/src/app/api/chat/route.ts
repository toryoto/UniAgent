/**
 * Chat API Route (SSE Streaming)
 *
 * Claude API を呼び出し、Server-Sent Events でストリーミングレスポンスを返す。
 * MCP Connector を使用してA2A Discovery MCPサーバーと連携。
 */

import { NextRequest } from 'next/server';
import type { ChatApiRequest, ChatSSEEvent, ToolCallLog } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';

// MCP Connector 用ベータヘッダー
const MCP_BETA_HEADER = 'mcp-client-2025-04-04';

// MCP Server設定
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001/sse';
const MCP_SERVER_NAME = 'a2a-discovery';

/**
 * SSE エンコーダー
 */
function encodeSSE(event: ChatSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/**
 * システムプロンプト
 */
function getSystemPrompt(mcpEnabled: boolean): string {
  const basePrompt = `あなたは UniAgent3 の AI アシスタントです。
ユーザーのタスクを支援し、必要に応じて外部エージェントを活用します。

## 基本動作
- タスクを分解して計画を立ててから実行してください
- 不明な点があれば確認してください`;

  if (mcpEnabled) {
    return `${basePrompt}

## 利用可能なツール

### discover_agents
ブロックチェーン上のAgentRegistryからエージェントを検索します。

**使用例:**
- カテゴリで検索: discover_agents(category: "travel")
- スキル名で検索: discover_agents(skillName: "flight")
- 価格フィルタ: discover_agents(maxPrice: 0.05)
- 評価フィルタ: discover_agents(minRating: 4.0)
- 複合検索: discover_agents(category: "travel", maxPrice: 0.1, minRating: 3.5)

**返却情報:**
- agentId: エージェントID
- name: エージェント名
- description: 説明
- url: Base URL
- endpoint: A2Aエンドポイント
- skills: スキル一覧
- price: 価格 (USDC)
- rating: 評価 (0-5)
- category: カテゴリ
- openapi: OpenAPI仕様URL (存在する場合)

ユーザーがエージェントを探している場合は、積極的にdiscover_agentsを使用してください。`;
  }

  return `${basePrompt}

## 現在利用可能な機能
一般的な質問への回答を行います。
エージェント検索機能 (discover_agents) は別途MCPサーバーの起動が必要です。`;
}

/**
 * Claude API リクエストボディを構築
 */
function buildClaudeRequestBody(
  messages: ChatApiRequest['messages'],
  mcpConfig?: ChatApiRequest['mcpConfig']
): Record<string, unknown> {
  const mcpEnabled = mcpConfig?.enabled ?? false;

  const body: Record<string, unknown> = {
    model: MODEL,
    max_tokens: 4096,
    stream: true,
    system: getSystemPrompt(mcpEnabled),
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  // MCP Connector設定
  if (mcpEnabled) {
    // MCPサーバー設定
    const mcpServerUrl = mcpConfig?.servers?.[0]?.url || MCP_SERVER_URL;

    body.mcp_servers = [
      {
        type: 'url',
        url: mcpServerUrl,
        name: MCP_SERVER_NAME,
      },
    ];

    // 利用可能なツール設定
    body.tools = [
      {
        type: 'mcp',
        server_label: MCP_SERVER_NAME,
        name: 'discover_agents',
      },
    ];
  }

  return body;
}

/**
 * Claude API ストリーミングレスポンスを SSE に変換
 */
async function* streamClaudeResponse(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<ChatSSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  let messageId = '';
  let currentToolCall: ToolCallLog | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        let parsed: Record<string, unknown>;
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        const eventType = parsed.type as string;

        switch (eventType) {
          case 'message_start': {
            const msg = parsed.message as Record<string, unknown> | undefined;
            messageId = (msg?.id as string) ?? crypto.randomUUID();
            yield { type: 'start', messageId };
            break;
          }

          case 'content_block_start': {
            const block = parsed.content_block as Record<string, unknown> | undefined;
            if (block?.type === 'tool_use') {
              currentToolCall = {
                id: (block.id as string) ?? crypto.randomUUID(),
                toolName: (block.name as string) ?? 'unknown',
                input: {},
                status: 'running',
                timestamp: new Date(),
              };
              yield { type: 'tool_use_start', toolCall: currentToolCall };
            }
            break;
          }

          case 'content_block_delta': {
            const delta = parsed.delta as Record<string, unknown> | undefined;
            if (delta?.type === 'text_delta') {
              const text = (delta.text as string) ?? '';
              if (text) yield { type: 'delta', content: text };
            } else if (delta?.type === 'input_json_delta' && currentToolCall) {
              const partial = (delta.partial_json as string) ?? '';
              yield {
                type: 'tool_use_delta',
                toolCallId: currentToolCall.id,
                partialInput: partial,
              };
            }
            break;
          }

          case 'content_block_stop': {
            if (currentToolCall) {
              // MCP Connectorがツール実行を自動処理
              yield { type: 'tool_use_end', toolCallId: currentToolCall.id, output: null };
              currentToolCall = null;
            }
            break;
          }

          case 'message_delta': {
            // stop_reason などはここで取得可能
            break;
          }

          case 'message_stop': {
            const usage = parsed.usage as Record<string, number> | undefined;
            yield {
              type: 'end',
              usage: usage
                ? { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
                : undefined,
            };
            break;
          }

          case 'error': {
            const error = parsed.error as Record<string, unknown> | undefined;
            yield { type: 'error', error: (error?.message as string) ?? 'Unknown error' };
            break;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'ANTHROPIC_API_KEY is not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let body: ChatApiRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return new Response(JSON.stringify({ success: false, error: 'messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const mcpEnabled = body.mcpConfig?.enabled ?? false;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  // MCP Connector有効時はベータヘッダーを追加
  if (mcpEnabled) {
    headers['anthropic-beta'] = MCP_BETA_HEADER;
  }

  const claudeBody = buildClaudeRequestBody(body.messages, body.mcpConfig);

  let claudeResponse: Response;
  try {
    claudeResponse = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(claudeBody),
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: `Failed to connect to Claude API: ${e}` }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (!claudeResponse.ok) {
    const errorText = await claudeResponse.text();
    return new Response(
      JSON.stringify({ success: false, error: `Claude API error: ${errorText}` }),
      { status: claudeResponse.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const reader = claudeResponse.body?.getReader();
  if (!reader) {
    return new Response(
      JSON.stringify({ success: false, error: 'No response body from Claude API' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // SSE ストリームを生成
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of streamClaudeResponse(reader)) {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        }
      } catch (e) {
        const errorEvent: ChatSSEEvent = {
          type: 'error',
          error: e instanceof Error ? e.message : 'Stream error',
        };
        controller.enqueue(encoder.encode(encodeSSE(errorEvent)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
