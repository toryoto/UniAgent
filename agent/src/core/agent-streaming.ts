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
      { streamMode: 'updates' }
    );

    let finalResponse = '';

    for await (const chunk of stream) {
      const [step, content] = Object.entries(chunk)[0] as [
        string,
        { messages?: unknown[] },
      ];

      logger.agent.info(`stream step: ${step}`);

      const messages = (content.messages || []) as Array<Record<string, unknown>>;

      for (const msg of messages) {
        if (typeof msg !== 'object' || msg === null) continue;

        const kwargs = (msg.kwargs as Record<string, unknown>) || msg;

        if (step === 'model_request' || step === 'model') {
          const msgContent = kwargs.content;

          // --- kwargs.content が配列の場合: text と tool_use を分離 ---
          if (Array.isArray(msgContent)) {
            const textParts = msgContent.filter(
              item => item.type === 'text',
            );

            const textStr = textParts.map((t) => t.text).join('');

            if (textStr) {
              stepCounter++;
              finalResponse = textStr;

              yield {
                type: 'llm_thinking',
                data: { content: textStr, step: stepCounter },
              };

              executionLog.push({
                step: stepCounter,
                type: 'llm',
                action: 'LLM response',
                details: { content: textStr },
                timestamp: new Date(),
              });

              logger.agent.info(`[model] text: ${textStr}`);
            }
          }

          // --- kwargs.content が文字列の場合: 最終テキストレスポンス ---
          if (typeof msgContent === 'string' && msgContent) {
            stepCounter++;
            finalResponse = msgContent;

            yield {
              type: 'llm_thinking',
              data: { content: msgContent, step: stepCounter },
            };

            executionLog.push({
              step: stepCounter,
              type: 'llm',
              action: 'LLM response',
              details: { content: msgContent },
              timestamp: new Date(),
            });

            logger.agent.info(`[model] text: ${msgContent.slice(0, 120)}...`);
          }

          const toolCalls = (
            Array.isArray(kwargs.tool_calls) ? kwargs.tool_calls : []
          ) as Array<{
            name: string;
            args: Record<string, unknown>;
            id?: string;
          }>;

          for (const toolCall of toolCalls) {
            stepCounter++;

            yield {
              type: 'tool_call',
              data: {
                name: toolCall.name,
                args: toolCall.args,
                step: stepCounter,
              },
            };

            executionLog.push({
              step: stepCounter,
              type: toolCall.name === 'execute_agent' ? 'payment' : 'logic',
              action: `Tool call: ${toolCall.name}`,
              details: toolCall.args,
              timestamp: new Date(),
            });

            yield { type: 'step', data: executionLog[executionLog.length - 1] };

            logger.agent.info(
              `[model] tool_call: ${toolCall.name}(${JSON.stringify(toolCall.args)})`,
            );
          }

        // ----- step: tools（ツール実行結果） -----
        } else if (step === 'tools') {
          const toolName = typeof kwargs.name === 'string' ? kwargs.name : 'unknown';
          const resultContent =
            typeof kwargs.content === 'string' ? kwargs.content : JSON.stringify(kwargs.content);

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