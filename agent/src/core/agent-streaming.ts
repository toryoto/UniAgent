import { initChatModel, createAgent } from 'langchain';
import type { AgentRequest, ExecutionLogEntry } from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAgentTool } from '../tools/index.js';
import { logger, logSeparator } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';

export type StreamEvent =
  | { type: 'start'; data: { message: string; maxBudget: number } }
  | { type: 'step'; data: ExecutionLogEntry }
  | { type: 'llm_token'; data: { token: string; step: number } }
  | { type: 'llm_thinking'; data: { content: string; step: number } }
  | { type: 'tool_call'; data: { name: string; args: Record<string, unknown>; step: number } }
  | { type: 'tool_result'; data: { name: string; result: string; step: number } }
  | { type: 'payment'; data: { amount: number; totalCost: number; remainingBudget: number } }
  | {
      type: 'final';
      data: { message: string; totalCost: number; executionLog: ExecutionLogEntry[] };
    }
  | { type: 'error'; data: { error: string; executionLog: ExecutionLogEntry[] } };

export async function* runAgentStream(request: AgentRequest): AsyncGenerator<StreamEvent> {
  const { message, walletId, walletAddress, maxBudget, agentId } = request;
  const executionLog: ExecutionLogEntry[] = [];
  let totalCost = 0;
  let stepCounter = 0;

  logSeparator('Agent Execution Start (Streaming)');

  yield { type: 'start', data: { message, maxBudget } };

  executionLog.push({
    step: ++stepCounter,
    type: 'llm',
    action: 'Request received',
    details: { message, maxBudget },
    timestamp: new Date(),
  });

  yield { type: 'step', data: executionLog[executionLog.length - 1] };

  try {
    const model = await initChatModel('claude-sonnet-4-5-20250929', { temperature: 0 });

    const agent = createAgent({
      model,
      tools: [discoverAgentsTool, executeAgentTool],
      systemPrompt: SYSTEM_PROMPT,
    });

    const userMessage = agentId
      ? `${message}\n\n[Context: walletId=${walletId}, walletAddress=${walletAddress}, maxBudget=${maxBudget} USDC, agentId=${agentId}]`
      : `${message}\n\n[Context: walletId=${walletId}, walletAddress=${walletAddress}, maxBudget=${maxBudget} USDC]`;

    const stream = await agent.stream(
      { messages: [{ role: 'user', content: userMessage }] },
      { streamMode: 'messages' }
    );

    let finalResponse = '';
    let currentTurnText = '';
    let prevNode = '';

    // ツール呼び出しチャンクの蓄積用
    const pendingToolCalls = new Map<
      number,
      { name: string; args: string; id: string }
    >();

    /**
     * 蓄積したツール呼び出しを flush して yield する
     */
    function* flushPendingToolCalls(): Generator<StreamEvent> {
      for (const [, tc] of pendingToolCalls) {
        stepCounter++;
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.args);
        } catch {}

        yield {
          type: 'tool_call',
          data: { name: tc.name, args: parsedArgs, step: stepCounter },
        };

        executionLog.push({
          step: stepCounter,
          type: tc.name === 'execute_agent' ? 'payment' : 'logic',
          action: `Tool call: ${tc.name}`,
          details: parsedArgs,
          timestamp: new Date(),
        });

        yield { type: 'step', data: executionLog[executionLog.length - 1] };

        logger.agent.info(
          `[model] tool_call: ${tc.name}(${JSON.stringify(parsedArgs)})`,
        );
      }
      pendingToolCalls.clear();
    }

    /**
     * モデルターン終了時に execution log を追加する
     */
    function addModelResponseLog(text: string) {
      if (!text) return;
      stepCounter++;
      executionLog.push({
        step: stepCounter,
        type: 'llm',
        action: 'LLM response',
        details: { content: text },
        timestamp: new Date(),
      });
      logger.agent.info(`[model] text: ${text.slice(0, 120)}...`);
    }

    for await (const event of stream) {
      // streamMode: 'messages' は [MessageChunk, metadata] タプルを yield する
      const [chunk, metadata] = event as [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        { langgraph_node?: string; langgraph_step?: number },
      ];
      const node: string = metadata?.langgraph_node ?? '';

      // ノード遷移の検出: model → tools
      if (node === 'tools' && prevNode !== 'tools' && prevNode !== '') {
        // モデルターンのテキストを記録
        addModelResponseLog(currentTurnText);
        // 蓄積したツール呼び出しを flush
        yield* flushPendingToolCalls();
      }

      // ノード遷移の検出: tools → model（再度モデル呼び出し）
      if (node !== 'tools' && prevNode === 'tools') {
        // 新しいモデルターン開始 → テキストをリセット
        currentTurnText = '';
      }

      prevNode = node;

      if (node === 'tools') {
        // ----- ツール実行結果 -----
        const toolName =
          typeof chunk.name === 'string' ? chunk.name : 'unknown';
        const resultContent =
          typeof chunk.content === 'string'
            ? chunk.content
            : JSON.stringify(chunk.content);

        stepCounter++;

        yield {
          type: 'tool_result',
          data: { name: toolName, result: resultContent, step: stepCounter },
        };

        executionLog.push({
          step: stepCounter,
          type: 'logic',
          action: `Tool result: ${toolName}`,
          details: { result: resultContent },
          timestamp: new Date(),
        });

        yield { type: 'step', data: executionLog[executionLog.length - 1] };

        logger.agent.info(
          `[tools] ${toolName} => ${resultContent.slice(0, 120)}`,
        );

        // execute_agent の結果から支払い情報を抽出
        if (toolName === 'execute_agent') {
          try {
            const parsed = JSON.parse(resultContent);
            if (parsed?.paymentAmount) {
              totalCost += parsed.paymentAmount;
              yield {
                type: 'payment',
                data: {
                  amount: parsed.paymentAmount,
                  totalCost,
                  remainingBudget: maxBudget - totalCost,
                },
              };
            }
          } catch {}
        }
      } else {
        // ----- モデル出力: トークン単位でストリーミング -----
        if (typeof chunk.content === 'string' && chunk.content) {
          currentTurnText += chunk.content;
          finalResponse = currentTurnText;
          yield {
            type: 'llm_token',
            data: { token: chunk.content, step: stepCounter + 1 },
          };
        } else if (Array.isArray(chunk.content)) {
          for (const part of chunk.content) {
            if (
              typeof part === 'object' &&
              part !== null &&
              part.type === 'text' &&
              part.text
            ) {
              currentTurnText += part.text;
              finalResponse = currentTurnText;
              yield {
                type: 'llm_token',
                data: { token: part.text, step: stepCounter + 1 },
              };
            }
          }
        }

        // ツール呼び出しチャンクの蓄積
        const toolCallChunks = (chunk.tool_call_chunks ?? []) as Array<{
          name?: string;
          args?: string;
          id?: string;
          index?: number;
        }>;
        for (const tc of toolCallChunks) {
          const idx = tc.index ?? 0;
          if (!pendingToolCalls.has(idx)) {
            pendingToolCalls.set(idx, { name: '', args: '', id: '' });
          }
          const entry = pendingToolCalls.get(idx)!;
          if (tc.name) entry.name += tc.name;
          if (tc.args) entry.args += tc.args;
          if (tc.id) entry.id = tc.id;
        }
      }
    }

    // ストリーム終了: 残りの蓄積データを flush
    if (currentTurnText && prevNode !== 'tools') {
      addModelResponseLog(currentTurnText);
    }
    yield* flushPendingToolCalls();

    executionLog.push({
      step: ++stepCounter,
      type: 'llm',
      action: 'Execution completed',
      details: { totalCost },
      timestamp: new Date(),
    });

    logSeparator('Agent Execution End');

    yield {
      type: 'final',
      data: {
        message: finalResponse,
        totalCost,
        executionLog,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    executionLog.push({
      step: ++stepCounter,
      type: 'error',
      action: 'Execution failed',
      details: { error: errorMessage },
      timestamp: new Date(),
    });

    yield {
      type: 'error',
      data: { error: errorMessage, executionLog },
    };
  }
}