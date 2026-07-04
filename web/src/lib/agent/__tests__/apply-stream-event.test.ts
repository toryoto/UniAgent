import { describe, expect, it } from 'vitest';
import { applyStreamEventToMessage } from '../apply-stream-event';
import type { AgentStreamMessage } from '../../types';

const baseMessage: AgentStreamMessage = {
  id: 'a1',
  role: 'assistant',
  content: '',
  timestamp: new Date(),
  isStreaming: true,
  toolCalls: [],
};

describe('applyStreamEventToMessage', () => {
  it('appends llm_token to content', () => {
    const { message } = applyStreamEventToMessage(baseMessage, {
      type: 'llm_token',
      data: { token: 'Hello', step: 1 },
    });
    expect(message.content).toBe('Hello');
  });

  it('sets error content and stops streaming', () => {
    const { message } = applyStreamEventToMessage(baseMessage, {
      type: 'error',
      data: { error: 'Agent failed' },
    });
    expect(message.content).toBe('Error: Agent failed');
    expect(message.isStreaming).toBe(false);
  });

  it('captures interrupt threadId', () => {
    const { message, threadId } = applyStreamEventToMessage(baseMessage, {
      type: 'interrupt',
      data: {
        threadId: 'thread-1',
        actionRequests: [{ name: 'execute_and_evaluate_agent', args: { maxPrice: 0.1 } }],
        reviewConfigs: [],
      },
    });
    expect(threadId).toBe('thread-1');
    expect(message.approval?.threadId).toBe('thread-1');
    expect(message.isStreaming).toBe(false);
  });
});
