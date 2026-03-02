import { initChatModel, createAgent, humanInTheLoopMiddleware } from 'langchain';
import type { HITLRequest, HITLResponse, Interrupt } from 'langchain';
import { MemorySaver, Command } from '@langchain/langgraph';
import { AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import type {
  AgentRequest,
  ExecutionLogEntry,
  StreamEvent,
} from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAndEvaluateAgentTool } from '../tools/index.js';
import { logger, logSeparator } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';

export type { StreamEvent };

// ── Helper ───────────────────────────────────────────────────────────────

/**
 * AIMessage.content（string | ContentBlock[]）からテキストを抽出する
 * .kwargs などの内部構造には依存しない
 */
function extractTextContent(
  content: string | Array<{ type: string; text?: string }>,
): string {
  if (typeof content === 'string') return content;
  return content
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}

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
  stream: AsyncIterable<[string, unknown]>,
  ctx: StreamProcessingContext,
  threadId: string,
): AsyncGenerator<StreamEvent> {
  for await (const [mode, chunk] of stream) {

    // ── 1. messages: LLMトークンのリアルタイムストリーミング ────────────
    if (mode === 'messages') {
      const [msg, metadata] = chunk as [unknown, { langgraph_node?: string }];

      // tools ノードのメッセージは updates モードで処理するためスキップ
      if (metadata?.langgraph_node === 'tools') continue;

      if (AIMessageChunk.isInstance(msg)) {
        const text = extractTextContent(msg.content as string | Array<{ type: string; text?: string }>);
        if (text) {
          ctx.finalResponse += text;
          yield {
            type: 'llm_token',
            data: { token: text, step: ctx.stepCounter + 1 },
          };
        }
      }

    // ── 2. updates: interrupt / ツール呼び出し / ツール結果 ─────────────
    } else if (mode === 'updates') {
      const updateChunk = chunk as Record<string, { messages?: unknown[] }>;

      // ---- 2-a. Interrupt 検出 ----
      if ('__interrupt__' in updateChunk) {
        const interrupts = (
          updateChunk as unknown as { __interrupt__: Interrupt<HITLRequest>[] }
        ).__interrupt__;
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
          return;
        }
      }

      const entries = Object.entries(updateChunk);
      if (entries.length === 0) continue;
      const [nodeName, state] = entries[0];
      const msgs = (state?.messages ?? []) as unknown[];

      // ---- 2-b. model ノード: LLMテキスト記録 + ツール呼び出し検出 ----
      if (nodeName === 'model' || nodeName === 'model_request') {
        for (const msg of msgs) {
          if (!AIMessage.isInstance(msg)) continue;

          // LLMテキストを executionLog に記録
          const text = extractTextContent(msg.content as string | Array<{ type: string; text?: string }>);
          if (text) {
            ctx.stepCounter++;
            ctx.executionLog.push({
              step: ctx.stepCounter,
              type: 'llm',
              action: 'LLM response',
              details: { content: text },
              timestamp: new Date(),
            });
            logger.agent.info(`[model] text: ${text.slice(0, 120)}...`);
          }

          // ツール呼び出し: isAIMessage の tool_calls プロパティを使用（.kwargs 不要）
          for (const tc of msg.tool_calls ?? []) {
            ctx.stepCounter++;

            const logEntry: ExecutionLogEntry = {
              step: ctx.stepCounter,
              type: tc.name === 'execute_and_evaluate_agent' ? 'payment' : 'logic',
              action: `Tool call: ${tc.name}`,
              details: tc.args,
              timestamp: new Date(),
            };
            ctx.executionLog.push(logEntry);

            yield {
              type: 'tool_call',
              data: { name: tc.name, args: tc.args, step: ctx.stepCounter },
            };
            yield { type: 'step', data: logEntry };

            logger.agent.info(
              `[model] tool_call: ${tc.name}(${JSON.stringify(tc.args)})`,
            );
          }
        }

      // ---- 2-c. tools ノード: ツール結果検出 ----
      } else if (nodeName === 'tools') {
        for (const msg of msgs) {
          if (!ToolMessage.isInstance(msg)) continue;

          // isToolMessage で型安全にアクセス（.kwargs 不要）
          const toolName = msg.name ?? 'unknown';
          const resultContent =
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content);

          ctx.stepCounter++;

          const logEntry: ExecutionLogEntry = {
            step: ctx.stepCounter,
            type: 'logic',
            action: `Tool result: ${toolName}`,
            details: { result: resultContent },
            timestamp: new Date(),
          };
          ctx.executionLog.push(logEntry);

          yield {
            type: 'tool_result',
            data: { name: toolName, result: resultContent, step: ctx.stepCounter },
          };
          yield { type: 'step', data: logEntry };

          logger.agent.info(
            `[tools] ${toolName} => ${resultContent.slice(0, 120)}`,
          );

          // execute_and_evaluate_agent の支払い情報抽出
          if (toolName === 'execute_and_evaluate_agent') {
            try {
              const parsed = JSON.parse(resultContent) as { paymentAmount?: number };
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
            } catch { /* 非JSON結果は無視 */ }
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
      ...(messageHistory ?? []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user' as const, content: userMessage },
    ];

    const threadId = crypto.randomUUID();

    const stream = await agent.stream(
      { messages },
      {
        // 'tools' は createAgent 未サポートのため使用しない
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

    for await (const event of processAgentStream(
      stream as AsyncIterable<[string, unknown]>,
      ctx,
      threadId,
    )) {
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
 * HITL の判断を受けてエージェントを再開する
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

    for await (const event of processAgentStream(
      stream as AsyncIterable<[string, unknown]>,
      ctx,
      threadId,
    )) {
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