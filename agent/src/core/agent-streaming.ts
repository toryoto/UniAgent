import { initChatModel, createAgent } from 'langchain';
import type { AgentRequest, ExecutionLogEntry } from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAgentTool } from '../tools/index.js';
import { logger, logStep, logSeparator } from '../utils/logger.js';
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

    // @ts-ignore
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
      const [step, content] = Object.entries(chunk)[0];
      const messages = content.messages || [];
      console.log('いいい', messages);

      for (const msg of messages) {
        console.log('ああああ', msg);
        const toolCalls = msg.tool_calls || [];
        const content = msg.content || '';
        const name = msg.name || '';

        // ツール呼び出し（AIメッセージの場合）
        if (toolCalls.length > 0) {
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
          }
        }

        // テキストレスポンス（AIメッセージでツール呼び出しがない場合）
        if (content && toolCalls.length === 0 && !name) {
          stepCounter++;
          finalResponse = content;

          yield {
            type: 'llm_thinking',
            data: { content, step: stepCounter },
          };

          executionLog.push({
            step: stepCounter,
            type: 'llm',
            action: 'LLM thinking',
            details: { content },
            timestamp: new Date(),
          });
        }

        // ツール結果メッセージ（nameプロパティがある場合）
        if (name && content) {
          stepCounter++;

          yield {
            type: 'tool_result',
            data: {
              name,
              result: content,
              step: stepCounter,
            },
          };

          executionLog.push({
            step: stepCounter,
            type: 'logic',
            action: `Tool result: ${name}`,
            details: { result: content },
            timestamp: new Date(),
          });

          yield { type: 'step', data: executionLog[executionLog.length - 1] };

          if (name === 'execute_agent') {
            try {
              const parsed = JSON.parse(content);
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
            } catch (e) {}
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
        message: finalResponse || 'タスクが完了しました。',
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
