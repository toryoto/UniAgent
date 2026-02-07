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

    // messages: トークン単位の LLM テキスト / updates: 完全なツール呼び出し・結果
    const stream = await agent.stream(
      { messages: [{ role: 'user', content: userMessage }] },
      { streamMode: ['messages', 'updates'] },
    );

    let finalResponse = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [mode, chunk] of stream as AsyncIterable<[string, any]>) {
      if (mode === 'messages') {
        // ----- トークン単位の LLM テキストストリーミング -----
        const [msg, metadata] = chunk as [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any,
          { langgraph_node?: string },
        ];

        // ToolMessage は updates モードで処理するためスキップ
        if (metadata?.langgraph_node === 'tools') continue;

        // テキストトークン
        if (typeof msg.content === 'string' && msg.content) {
          finalResponse += msg.content;
          yield {
            type: 'llm_token',
            data: { token: msg.content, step: stepCounter + 1 },
          };
        } else if (Array.isArray(msg.content)) {
          for (const part of msg.content) {
            if (part?.type === 'text' && part.text) {
              finalResponse += part.text;
              yield {
                type: 'llm_token',
                data: { token: part.text, step: stepCounter + 1 },
              };
            }
          }
        }
        // tool_call_chunks は無視（updates で完全な形で取得）
      } else if (mode === 'updates') {
        // ----- ノード完了時の完全な出力 -----
        const entries = Object.entries(chunk) as [
          string,
          { messages?: unknown[] },
        ][];
        if (entries.length === 0) continue;
        const [nodeName, state] = entries[0];
        const msgs = (state?.messages || []) as Array<
          Record<string, unknown>
        >;

        if (nodeName === 'model' || nodeName === 'model_request') {
          for (const msg of msgs) {
            const kwargs = (msg.kwargs as Record<string, unknown>) || msg;

            // テキストの execution log 記録
            const textContent = kwargs.content;
            let textStr = '';
            if (typeof textContent === 'string' && textContent) {
              textStr = textContent;
            } else if (Array.isArray(textContent)) {
              textStr = textContent
                .filter((p) => p?.type === 'text')
                .map((p) => p.text)
                .join('');
            }
            if (textStr) {
              stepCounter++;
              finalResponse = textStr;
              executionLog.push({
                step: stepCounter,
                type: 'llm',
                action: 'LLM response',
                details: { content: textStr },
                timestamp: new Date(),
              });
              logger.agent.info(
                `[model] text: ${textStr.slice(0, 120)}...`,
              );
            }

            const toolCalls = (
              Array.isArray(kwargs.tool_calls) ? kwargs.tool_calls : []
            ) as Array<{ name: string; args: Record<string, unknown> }>;

            for (const tc of toolCalls) {
              stepCounter++;

              yield {
                type: 'tool_call',
                data: { name: tc.name, args: tc.args, step: stepCounter },
              };

              executionLog.push({
                step: stepCounter,
                type:
                  tc.name === 'execute_agent' ? 'payment' : 'logic',
                action: `Tool call: ${tc.name}`,
                details: tc.args,
                timestamp: new Date(),
              });

              yield {
                type: 'step',
                data: executionLog[executionLog.length - 1],
              };

              logger.agent.info(
                `[model] tool_call: ${tc.name}(${JSON.stringify(tc.args)})`,
              );
            }
          }
        } else if (nodeName === 'tools') {
          for (const msg of msgs) {
            const kwargs = (msg.kwargs as Record<string, unknown>) || msg;
            const toolName =
              typeof kwargs.name === 'string' ? kwargs.name : 'unknown';
            const resultContent =
              typeof kwargs.content === 'string'
                ? kwargs.content
                : JSON.stringify(kwargs.content);

            stepCounter++;

            yield {
              type: 'tool_result',
              data: {
                name: toolName,
                result: resultContent,
                step: stepCounter,
              },
            };

            executionLog.push({
              step: stepCounter,
              type: 'logic',
              action: `Tool result: ${toolName}`,
              details: { result: resultContent },
              timestamp: new Date(),
            });

            yield {
              type: 'step',
              data: executionLog[executionLog.length - 1],
            };

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
          }
        }
      }
    }

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
