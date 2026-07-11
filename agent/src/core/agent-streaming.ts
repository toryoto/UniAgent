/**
 * @module core/agent-streaming
 * SSE ストリーミングエージェント実行の公開 API（本番実行経路の入口）。
 * LangGraph + HITL ミドルウェアを使用し、`StreamEvent` をリアルタイムで yield する。
 * agent の生成は core/agent-factory、累積コストは core/thread-cost-store に委譲する。
 */

import type { HITLResponse } from 'langchain';
import { Command } from '@langchain/langgraph';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentRequest, StreamEvent } from '@agent-marketplace/shared';
import { createLogger, bindLogContext } from '@agent-marketplace/shared/logger';
import { getAgent } from './agent-factory.js';
import { getThreadCost, setThreadCost } from './thread-cost-store.js';
import { expandHistoryToLangChainMessages } from './history-to-messages.js';
import { buildStreamingUserMessage } from './message-builder.js';
import { processAgentStream } from './stream-processor.js';
import type { StreamProcessingContext } from '../types/index.js';

export type { StreamEvent };

const log = createLogger('agent');

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

  yield { type: 'start', data: { message } };

  const threadId = crypto.randomUUID();
  // 以降この実行スコープの全ログに threadId を自動付与する（HITL resume まで追跡可能）
  bindLogContext({ threadId });
  log.info({ agentId }, 'Agent execution started (streaming)');

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

  yield* streamAgentTurn({
    threadId,
    streamInput: { messages },
    autoApproveThreshold,
    initialCost: 0,
    endLabel: 'Agent Execution End',
  });
}

/**
 * HITL 判断を受けてエージェント実行を再開する。
 * ユーザーの approve / edit / reject に基づいて処理を続行する。
 * 割り込み前までの累積コストを thread-cost-store から復元し、予算判定を継続する。
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
  bindLogContext({ threadId });
  log.info({ decisions }, 'Resuming agent');

  yield* streamAgentTurn({
    threadId,
    streamInput: new Command({ resume: decisions }),
    autoApproveThreshold,
    initialCost: getThreadCost(threadId),
    endLabel: 'Agent Resume End',
  });
}

// ── Private ───────────────────────────────────────────────────────────────

interface StreamAgentTurnParams {
  threadId: string;
  /** agent.stream の第一引数（初回は messages、resume は Command） */
  streamInput: unknown;
  autoApproveThreshold: number;
  /** ターン開始時点の累積コスト（resume では割り込み前のコストを引き継ぐ） */
  initialCost: number;
  endLabel: string;
}

/**
 * run / resume 共通のストリーミングループ。
 * interrupt 発生時はイベントを yield して終了し、正常完了時は final を yield する。
 * どの終了経路でも累積コストを thread-cost-store に記録する。
 */
async function* streamAgentTurn(params: StreamAgentTurnParams): AsyncGenerator<StreamEvent> {
  const { threadId, streamInput, autoApproveThreshold, initialCost, endLabel } = params;

  const ctx: StreamProcessingContext = {
    stepCounter: 0,
    totalCost: initialCost,
    autoApproveThreshold,
    finalResponse: '',
  };

  try {
    const agent = await getAgent();

    const stream = await agent.stream(streamInput, {
      streamMode: ['messages', 'updates'],
      configurable: { thread_id: threadId },
    });

    for await (const event of processAgentStream(
      agent,
      stream as AsyncIterable<[string, unknown]>,
      ctx,
      threadId,
    )) {
      yield event;
      if (event.type === 'interrupt') return;
    }

    log.info({ totalCost: ctx.totalCost }, endLabel);

    yield {
      type: 'final',
      data: {
        message: ctx.finalResponse,
        totalCost: ctx.totalCost,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    log.error({ err: error }, 'Stream model call failed');
    yield { type: 'error', data: { error: errorMessage } };
  } finally {
    // interrupt / final / error のいずれで抜けても resume 用に累積コストを保存する
    setThreadCost(threadId, ctx.totalCost);
  }
}
