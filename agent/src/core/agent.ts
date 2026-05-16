/**
 * @module core/agent
 * LangChain ReAct エージェントの非ストリーミング実行。
 * 単一リクエスト → 完了結果を返すシンプルなインターフェース。
 */

import { initChatModel, createAgent } from 'langchain';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentRequest, AgentResponse } from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAgentTool, fetchAgentSpecTool } from '../tools/index.js';
import { expandHistoryToLangChainMessages } from './history-to-messages.js';
import { buildNonStreamingUserMessage } from './message-builder.js';
import { logger, logStep, logSeparator } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';

/**
 * エージェントを非ストリーミングモードで実行する。
 * ReAct ループが完了するまでブロッキングし、最終結果を返す。
 *
 * @param request - エージェント実行リクエスト
 * @returns 実行結果（成功/失敗、メッセージ、合計コスト）
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const { message, walletId, walletAddress, autoApproveThreshold, agentId, messageHistory } = request;
  let totalCost = 0;
  let stepCounter = 0;

  logSeparator('Agent Execution Start');
  logger.agent.info('Received request', { message, walletId, walletAddress, autoApproveThreshold, agentId });

  try {
    const model = await initChatModel('claude-sonnet-4-5-20250929', { temperature: 0 });

    // @ts-ignore - Type instantiation is excessively deep (TS2589)
    const agent = createAgent({
      model,
      tools: [discoverAgentsTool, fetchAgentSpecTool, executeAgentTool],
      systemPrompt: SYSTEM_PROMPT,
    });

    const userMessage = buildNonStreamingUserMessage({
      message,
      walletId,
      walletAddress,
      autoApproveThreshold,
      totalCost,
      agentId,
    });

    logStep(stepCounter, 'llm', 'Starting ReAct agent loop');

    const messages = [
      ...expandHistoryToLangChainMessages(messageHistory),
      new HumanMessage(userMessage),
    ];

    const result = await agent.invoke(
      { messages },
      { context: { agentId } },
    );

    totalCost = extractTotalCost(result.messages, totalCost, () => ++stepCounter);

    const lastMessage = result.messages[result.messages.length - 1];
    const finalResponse =
      lastMessage._getType() === 'ai'
        ? (lastMessage as { content: string }).content
        : 'タスクが完了しました。';

    stepCounter++;
    logStep(stepCounter, 'llm', 'Agent execution completed');
    logSeparator('Agent Execution End');
    logger.agent.success('Total cost', { totalCost });

    return {
      success: true,
      message: typeof finalResponse === 'string' ? finalResponse : JSON.stringify(finalResponse),
      totalCost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Agent execution failed', { error: errorMessage });
    logSeparator('Agent Execution End (Error)');

    return {
      success: false,
      message: '',
      totalCost,
      error: errorMessage,
    };
  }
}

// ── Private ───────────────────────────────────────────────────────────────

/**
 * 結果メッセージから決済情報を抽出し、合計コストを計算する。
 */
function extractTotalCost(
  messages: unknown[],
  initialCost: number,
  incrementStep: () => number,
): number {
  let totalCost = initialCost;

  for (const msg of messages) {
    const typedMsg = msg as { _getType: () => string; tool_calls?: Array<{ name: string; args: Record<string, unknown> }>; content?: string };

    if (typedMsg._getType() === 'ai') {
      if (typedMsg.tool_calls && typedMsg.tool_calls.length > 0) {
        for (const toolCall of typedMsg.tool_calls) {
          incrementStep();
          logStep(incrementStep() - 1, 'mcp', `Tool call: ${toolCall.name}`);
          logger.mcp.info('Tool arguments', toolCall.args);
        }
      }
    }

    if (typedMsg._getType() === 'tool') {
      try {
        const parsed = JSON.parse(typedMsg.content ?? '{}') as { paymentAmount?: number };
        if (parsed.paymentAmount) {
          totalCost += parsed.paymentAmount;
          logger.payment.success(`Payment: $${parsed.paymentAmount} USDC`, { totalCost });
        }
      } catch {
        // JSON parse failure is non-critical
      }
    }
  }

  return totalCost;
}
