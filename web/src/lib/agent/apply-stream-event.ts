/**
 * @module lib/agent/apply-stream-event
 * StreamEvent を UI 向け AgentStreamMessage に適用する純関数。
 */

import type { StreamEvent } from '@agent-marketplace/shared';
import type { AgentStreamMessage, AgentToolCall } from '@/lib/types';

export type ApplyStreamEventResult = {
  message: AgentStreamMessage;
  /** interrupt 発生時の threadId（あれば） */
  threadId?: string;
};

/**
 * 単一の StreamEvent をアシスタントメッセージに適用する。
 */
export function applyStreamEventToMessage(
  message: AgentStreamMessage,
  event: StreamEvent,
): ApplyStreamEventResult {
  switch (event.type) {
    case 'llm_token':
      return {
        message: { ...message, content: message.content + event.data.token },
      };

    case 'llm_thinking':
      return {
        message: { ...message, content: event.data.content },
      };

    case 'tool_call': {
      const newToolCall: AgentToolCall = {
        toolCallId: event.data.toolCallId,
        name: event.data.name,
        args: event.data.args,
        status: 'calling',
        step: event.data.step,
      };
      return {
        message: {
          ...message,
          toolCalls: [...(message.toolCalls ?? []), newToolCall],
        },
      };
    }

    case 'tool_result': {
      const updatedToolCalls = (message.toolCalls ?? []).map((tc) =>
        tc.toolCallId === event.data.toolCallId && tc.status === 'calling'
          ? { ...tc, result: event.data.result, status: 'completed' as const }
          : tc,
      );
      return { message: { ...message, toolCalls: updatedToolCalls } };
    }

    case 'payment':
      return { message: { ...message, payment: event.data } };

    case 'interrupt':
      return {
        message: {
          ...message,
          isStreaming: false,
          approval: {
            threadId: event.data.threadId,
            actionRequests: event.data.actionRequests,
            reviewConfigs: event.data.reviewConfigs,
          },
        },
        threadId: event.data.threadId,
      };

    case 'final':
      return {
        message: {
          ...message,
          content: event.data.message,
          totalCost: event.data.totalCost,
          isStreaming: false,
        },
      };

    case 'error':
      return {
        message: {
          ...message,
          content: message.content || `Error: ${event.data.error}`,
          isStreaming: false,
        },
      };

    case 'start':
    default:
      return { message };
  }
}
