/**
 * @module core/stream-processor
 * LangGraph ストリームイベントの処理ジェネレータ。
 * messages / updates モードのチャンクを解析し、
 * クライアント向けの StreamEvent に変換する。
 */

import type { HITLRequest, Interrupt } from 'langchain';
import { Command } from '@langchain/langgraph';
import { AIMessage, AIMessageChunk, ToolMessage } from '@langchain/core/messages';
import type { StreamEvent, HITLDecision } from '@agent-marketplace/shared';
import type { StreamProcessingContext } from '../types/index.js';
import { shouldAutoApprove } from './auto-approve.js';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('agent');
const paymentLog = createLogger('payment');

/**
 * LangGraph のストリームを処理し、クライアント向け StreamEvent を yield する。
 * HITL 割り込み検出時は自動承認判定を行い、閾値以内であれば再帰的に処理を継続する。
 *
 * @param agent - LangGraph エージェントインスタンス
 * @param stream - LangGraph の [mode, chunk] ストリーム
 * @param ctx - ストリーム処理コンテキスト（可変参照）
 * @param threadId - LangGraph スレッド ID
 */
export async function* processAgentStream(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any,
  stream: AsyncIterable<[string, unknown]>,
  ctx: StreamProcessingContext,
  threadId: string,
): AsyncGenerator<StreamEvent> {
  for await (const [mode, chunk] of stream) {
    if (mode === 'messages') {
      yield* handleMessagesMode(chunk, ctx);
    } else if (mode === 'updates') {
      const result = yield* handleUpdatesMode(agent, chunk, ctx, threadId);
      if (result === 'interrupt_sent') return;
    }
  }
}

/**
 * AIMessage.content（string | ContentBlock[]）からテキストを抽出する。
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

function* handleMessagesMode(
  chunk: unknown,
  ctx: StreamProcessingContext,
): Generator<StreamEvent> {
  const [msg, metadata] = chunk as [unknown, { langgraph_node?: string }];

  if (metadata?.langgraph_node === 'tools') return;

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
}

async function* handleUpdatesMode(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent: any,
  chunk: unknown,
  ctx: StreamProcessingContext,
  threadId: string,
): AsyncGenerator<StreamEvent, 'interrupt_sent' | void> {
  const updateChunk = chunk as Record<string, { messages?: unknown[] }>;

  // Interrupt 検出
  if ('__interrupt__' in updateChunk) {
    const interrupts = (
      updateChunk as unknown as { __interrupt__: Interrupt<HITLRequest>[] }
    ).__interrupt__;

    if (interrupts.length > 0) {
      const hitlRequest = interrupts[0].value;
      log.info(
        { actions: hitlRequest.actionRequests.map((a: { name: string }) => a.name) },
        'HITL interrupt detected',
      );

      if (shouldAutoApprove(hitlRequest, ctx)) {
        const decisions: HITLDecision[] = hitlRequest.actionRequests.map(
          () => ({ type: 'approve' as const }),
        );
        const resumeStream = await agent.stream(
          new Command({ resume: { decisions } }),
          {
            streamMode: ['messages', 'updates'],
            configurable: { thread_id: threadId },
          },
        );
        yield* processAgentStream(
          agent,
          resumeStream as AsyncIterable<[string, unknown]>,
          ctx,
          threadId,
        );
        return 'interrupt_sent';
      }

      yield {
        type: 'interrupt',
        data: {
          threadId,
          actionRequests: hitlRequest.actionRequests,
          reviewConfigs: hitlRequest.reviewConfigs,
        },
      };
      return 'interrupt_sent';
    }
  }

  const entries = Object.entries(updateChunk);
  if (entries.length === 0) return;
  const [nodeName, state] = entries[0];
  const msgs = (state?.messages ?? []) as unknown[];

  if (nodeName === 'model' || nodeName === 'model_request') {
    yield* handleModelNode(msgs, ctx);
  } else if (nodeName === 'tools') {
    yield* handleToolsNode(msgs, ctx);
  }
}

function* handleModelNode(
  msgs: unknown[],
  ctx: StreamProcessingContext,
): Generator<StreamEvent> {
  for (const msg of msgs) {
    if (!AIMessage.isInstance(msg)) continue;

    const text = extractTextContent(msg.content as string | Array<{ type: string; text?: string }>);
    if (text) {
      ctx.stepCounter++;
      log.debug({ step: ctx.stepCounter, preview: text.slice(0, 120) }, 'model text');
    }

    for (const tc of msg.tool_calls ?? []) {
      ctx.stepCounter++;
      const toolCallId =
        typeof tc.id === 'string' && tc.id.length > 0
          ? tc.id
          : `call_${tc.name}_${ctx.stepCounter}`;

      yield {
        type: 'tool_call',
        data: {
          toolCallId,
          name: tc.name,
          args: tc.args as Record<string, unknown>,
          step: ctx.stepCounter,
        },
      };

      log.info({ step: ctx.stepCounter, tool: tc.name, args: tc.args }, 'model tool_call');
    }
  }
}

function* handleToolsNode(
  msgs: unknown[],
  ctx: StreamProcessingContext,
): Generator<StreamEvent> {
  for (const msg of msgs) {
    if (!ToolMessage.isInstance(msg)) continue;

    const toolName = msg.name ?? 'unknown';
    const resultContent =
      typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);

    ctx.stepCounter++;
    const toolCallId =
      typeof msg.tool_call_id === 'string' && msg.tool_call_id.length > 0
        ? msg.tool_call_id
        : `call_${toolName}_${ctx.stepCounter}`;

    yield {
      type: 'tool_result',
      data: {
        toolCallId,
        name: toolName,
        result: resultContent,
        step: ctx.stepCounter,
      },
    };

    log.info({ step: ctx.stepCounter, tool: toolName, preview: resultContent.slice(0, 120) }, 'tool result');

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
      } catch (err) {
        paymentLog.warn(
          { err, preview: resultContent.slice(0, 240) },
          'execute_and_evaluate_agent result was not valid JSON; payment amount not extracted',
        );
      }
    }
  }
}
