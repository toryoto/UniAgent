/**
 * @module core/agent-streaming
 * SSE ストリーミングエージェント実行の公開 API。
 * LangGraph + HITL ミドルウェアを使用し、リアルタイムイベントを yield する。
 */

import { initChatModel, createAgent, humanInTheLoopMiddleware } from 'langchain';
import type { HITLResponse } from 'langchain';
import { MemorySaver, Command } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentRequest, StreamEvent } from '@agent-marketplace/shared';
import { expandHistoryToLangChainMessages } from './history-to-messages.js';
import { buildStreamingUserMessage } from './message-builder.js';
import { processAgentStream } from './stream-processor.js';
import { discoverAgentsTool, executeAndEvaluateAgentTool, fetchAgentSpecTool } from '../tools/index.js';
import { logger, logSeparator } from '@agent-marketplace/shared/logger';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';
import type { StreamProcessingContext } from '../types/index.js';

export type { StreamEvent };

// ── Module-level singletons ───────────────────────────────────────────────

const checkpointer = new MemorySaver();

const hitlMiddleware = humanInTheLoopMiddleware({
  interruptOn: {
    discover_agents: false,
    fetch_agent_spec: false,
    execute_and_evaluate_agent: {
      allowedDecisions: ['approve', 'edit', 'reject'],
      description: (toolCall) => {
        const { agentId, task, data, maxPrice } = toolCall.args as Record<string, unknown>;
        const lines = [`Execute external agent.`, `Agent ID: ${agentId ?? '(missing)'}`];
        if (task) lines.push(`Task: ${task}`);
        if (data) lines.push(`Params: ${JSON.stringify(data, null, 2)}`);
        lines.push(`Max Price: $${maxPrice} USDC`, '', 'Do you approve?');
        return lines.join('\n');
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
    tools: [discoverAgentsTool, fetchAgentSpecTool, executeAndEvaluateAgentTool],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
    middleware: [hitlMiddleware],
  });
  return _agent;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * エージェントをストリーミングモードで実行する。
 * LLM トークン、ツール呼び出し、決済情報、HITL 割り込みなどをリアルタイムで yield する。
 *
 * @param request - エージェント実行リクエスト（メッセージ、ウォレット情報、閾値など）
 * @yields StreamEvent - クライアントに送信するイベント
 */
export async function* runAgentStream(request: AgentRequest): AsyncGenerator<StreamEvent> {
  const { message, walletId, walletAddress, autoApproveThreshold, agentId, messageHistory } = request;

  logSeparator('Agent Execution Start (Streaming)');
  yield { type: 'start', data: { message } };

  let threadId: string | undefined;

  try {
    const agent = await getAgent();

    const userMessage = buildStreamingUserMessage({
      message,
      walletId,
      walletAddress,
      autoApproveThreshold,
      agentId,
    });

    const messages = [
      ...expandHistoryToLangChainMessages(messageHistory),
      new HumanMessage(userMessage),
    ];

    threadId = crypto.randomUUID();

    const stream = await agent.stream(
      { messages },
      {
        streamMode: ['messages', 'updates'],
        configurable: { thread_id: threadId },
      },
    );

    const ctx: StreamProcessingContext = {
      stepCounter: 0,
      totalCost: 0,
      autoApproveThreshold,
      finalResponse: '',
    };

    for await (const event of processAgentStream(
      agent,
      stream as AsyncIterable<[string, unknown]>,
      ctx,
      threadId,
    )) {
      yield event;
      if (event.type === 'interrupt') return;
    }

    logSeparator('Agent Execution End');

    yield {
      type: 'final',
      data: {
        message: ctx.finalResponse,
        totalCost: ctx.totalCost,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Stream model call failed', { error: errorMessage, threadId });
    yield { type: 'error', data: { error: errorMessage } };
  }
}

/**
 * HITL 判断を受けてエージェント実行を再開する。
 * ユーザーの approve / edit / reject に基づいて処理を続行する。
 *
 * @param threadId - 中断されたスレッドの ID
 * @param decisions - ユーザーの HITL 判断
 * @param autoApproveThreshold - 自動承認閾値（再帰的 auto-approve 用）
 * @yields StreamEvent - クライアントに送信するイベント
 */
export async function* resumeAgentStream(
  threadId: string,
  decisions: HITLResponse,
  autoApproveThreshold: number,
): AsyncGenerator<StreamEvent> {
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
      stepCounter: 0,
      totalCost: 0,
      autoApproveThreshold,
      finalResponse: '',
    };

    for await (const event of processAgentStream(
      agent,
      stream as AsyncIterable<[string, unknown]>,
      ctx,
      threadId,
    )) {
      yield event;
      if (event.type === 'interrupt') return;
    }

    logSeparator('Agent Resume End');

    yield {
      type: 'final',
      data: {
        message: ctx.finalResponse,
        totalCost: ctx.totalCost,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Stream model call failed', { error: errorMessage, threadId });
    yield { type: 'error', data: { error: errorMessage } };
  }
}
