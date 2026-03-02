import { initChatModel, createAgent, humanInTheLoopMiddleware } from 'langchain';
import type { HITLRequest, HITLResponse, Interrupt } from 'langchain';
import { MemorySaver, Command } from '@langchain/langgraph';
import type {
  AgentRequest,
  ExecutionLogEntry,
  StreamEvent,
} from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAndEvaluateAgentTool } from '../tools/index.js';
import { logger, logSeparator } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';

export type { StreamEvent };

// ── Module-level singletons (shared between run & resume) ────────────────

const checkpointer = new MemorySaver();

const hitlMiddleware = humanInTheLoopMiddleware({
  interruptOn: {
    discover_agents: false,
    execute_and_evaluate_agent: {
      allowedDecisions: ['approve', 'edit', 'reject'],
      description: (toolCall) => {
        const { agentUrl, task, maxPrice } = toolCall.args as Record<string, unknown>;
        return `外部Agentを実行します。\nAgent URL: ${agentUrl}\nタスク: ${task}\n最大価格: $${maxPrice} USDC\n\n承認しますか？`;
      },
    },
  },
});

// Lazy-initialized agent singleton
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _agent: any = null;

async function getAgent() {
  if (_agent) return _agent;

  const model = await initChatModel('claude-sonnet-4-5-20250929', { temperature: 0 });

  _agent = createAgent({
    model,
    tools: [discoverAgentsTool, executeAndEvaluateAgentTool],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
    middleware: [hitlMiddleware],
  });

  return _agent;
}

// ── Stream processing helper ─────────────────────────────────────────────

interface StreamProcessingContext {
  stepCounter: number;
  totalCost: number;
  autoApproveThreshold: number;
  finalResponse: string;
  executionLog: ExecutionLogEntry[];
}

async function* processAgentStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stream: AsyncIterable<[string, any]>,
  ctx: StreamProcessingContext,
  threadId: string,
): AsyncGenerator<StreamEvent> {
  for await (const [mode, chunk] of stream) {
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
        ctx.finalResponse += msg.content;
        yield {
          type: 'llm_token',
          data: { token: msg.content, step: ctx.stepCounter + 1 },
        };
      } else if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part?.type === 'text' && part.text) {
            ctx.finalResponse += part.text;
            yield {
              type: 'llm_token',
              data: { token: part.text, step: ctx.stepCounter + 1 },
            };
          }
        }
      }
    } else if (mode === 'updates') {
      // ----- ノード完了時の完全な出力 -----

      // Check for interrupt
      if (chunk && typeof chunk === 'object' && '__interrupt__' in chunk) {
        const interrupts = chunk.__interrupt__ as Interrupt<HITLRequest>[];
        if (interrupts.length > 0) {
          const hitlRequest = interrupts[0].value;
          logger.agent.info('HITL interrupt detected', {
            actions: hitlRequest.actionRequests.map((a: { name: string }) => a.name),
          });

          yield {
            type: 'interrupt',
            data: {
              threadId,
              actionRequests: hitlRequest.actionRequests,
              reviewConfigs: hitlRequest.reviewConfigs,
            },
          };
          // Interrupt means we stop processing the stream
          return;
        }
      }

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
            ctx.stepCounter++;
            ctx.finalResponse = textStr;
            ctx.executionLog.push({
              step: ctx.stepCounter,
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
            ctx.stepCounter++;

            yield {
              type: 'tool_call',
              data: { name: tc.name, args: tc.args, step: ctx.stepCounter },
            };

            ctx.executionLog.push({
              step: ctx.stepCounter,
              type:
                tc.name === 'execute_and_evaluate_agent' ? 'payment' : 'logic',
              action: `Tool call: ${tc.name}`,
              details: tc.args,
              timestamp: new Date(),
            });

            yield {
              type: 'step',
              data: ctx.executionLog[ctx.executionLog.length - 1],
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

          ctx.stepCounter++;

          yield {
            type: 'tool_result',
            data: {
              name: toolName,
              result: resultContent,
              step: ctx.stepCounter,
            },
          };

          ctx.executionLog.push({
            step: ctx.stepCounter,
            type: 'logic',
            action: `Tool result: ${toolName}`,
            details: { result: resultContent },
            timestamp: new Date(),
          });

          yield {
            type: 'step',
            data: ctx.executionLog[ctx.executionLog.length - 1],
          };

          logger.agent.info(
            `[tools] ${toolName} => ${resultContent.slice(0, 120)}`,
          );

          // execute_and_evaluate_agent の結果から支払い情報を抽出
          if (toolName === 'execute_and_evaluate_agent') {
            try {
              const parsed = JSON.parse(resultContent);
              if (parsed?.paymentAmount) {
                ctx.totalCost += parsed.paymentAmount;
                yield {
                  type: 'payment',
                  data: {
                    amount: parsed.paymentAmount,
                    totalCost: ctx.totalCost,
                    remainingBudget: ctx.autoApproveThreshold - ctx.totalCost,
                  },
                };
              }
            } catch {}
          }
        }
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────

export async function* runAgentStream(request: AgentRequest): AsyncGenerator<StreamEvent> {
  const { message, walletId, walletAddress, autoApproveThreshold, agentId, messageHistory } = request;
  const executionLog: ExecutionLogEntry[] = [];
  let totalCost = 0;
  let stepCounter = 0;

  logSeparator('Agent Execution Start (Streaming)');

  yield { type: 'start', data: { message } };

  executionLog.push({
    step: ++stepCounter,
    type: 'llm',
    action: 'Request received',
    details: { message, autoApproveThreshold },
    timestamp: new Date(),
  });

  yield { type: 'step', data: executionLog[executionLog.length - 1] };

  try {
    const agent = await getAgent();

    const userMessage = agentId
      ? `${message}
## コンテキスト
- wallet_id: ${walletId}
- wallet_address: ${walletAddress}
- auto_approve_threshold: $${autoApproveThreshold} USDC
- 指定エージェントID: ${agentId}

## 重要な指示（指定エージェントの場合）
※まず discover_agents({ agentId: "${agentId}" }) でエージェント情報を取得してください
※そのエージェントがタスクに適している場合のみ execute_and_evaluate_agent で実行してください
※タスクに合わない場合や追加エージェントが必要な場合は、カテゴリやスキル名で discover_agents を再実行してください`
      : `${message}\n\n[Context: walletId=${walletId}, walletAddress=${walletAddress}, autoApproveThreshold=${autoApproveThreshold} USDC]`;

    const messages = [
      ...(messageHistory || []).map(m => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    // Generate unique thread_id for this conversation
    const threadId = crypto.randomUUID();

    const stream = await agent.stream(
      { messages },
      {
        streamMode: ['messages', 'updates'],
        configurable: { thread_id: threadId },
      },
    );

    const ctx: StreamProcessingContext = {
      stepCounter,
      totalCost,
      autoApproveThreshold,
      finalResponse: '',
      executionLog,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const event of processAgentStream(stream as AsyncIterable<[string, any]>, ctx, threadId)) {
      yield event;
      // If we got an interrupt, stop here
      if (event.type === 'interrupt') return;
    }

    // Update local variables from context
    stepCounter = ctx.stepCounter;
    totalCost = ctx.totalCost;

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
        message: ctx.finalResponse,
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

/**
 * Resume an interrupted agent stream with HITL decisions
 */
export async function* resumeAgentStream(
  threadId: string,
  decisions: HITLResponse,
  autoApproveThreshold: number,
): AsyncGenerator<StreamEvent> {
  const executionLog: ExecutionLogEntry[] = [];
  let stepCounter = 0;
  let totalCost = 0;

  logSeparator('Agent Resume (Streaming)');
  logger.agent.info('Resuming agent', { threadId, decisions });

  try {
    const agent = await getAgent();

    const stream = await agent.stream(
      new Command({ resume: decisions }),
      {
        streamMode: ['messages', 'updates'],
        configurable: { thread_id: threadId },
      },
    );

    const ctx: StreamProcessingContext = {
      stepCounter,
      totalCost,
      autoApproveThreshold,
      finalResponse: '',
      executionLog,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const event of processAgentStream(stream as AsyncIterable<[string, any]>, ctx, threadId)) {
      yield event;
      if (event.type === 'interrupt') return;
    }

    stepCounter = ctx.stepCounter;
    totalCost = ctx.totalCost;

    executionLog.push({
      step: ++stepCounter,
      type: 'llm',
      action: 'Execution completed',
      details: { totalCost },
      timestamp: new Date(),
    });

    logSeparator('Agent Resume End');

    yield {
      type: 'final',
      data: {
        message: ctx.finalResponse,
        totalCost,
        executionLog,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    executionLog.push({
      step: ++stepCounter,
      type: 'error',
      action: 'Resume failed',
      details: { error: errorMessage },
      timestamp: new Date(),
    });

    yield {
      type: 'error',
      data: { error: errorMessage, executionLog },
    };
  }
}
