/**
 * Paygent X - LangChain v1 Implementation
 *
 * LangChain v1を使用したシンプルなReActエージェント実装
 * - discover_agents: MCPサーバー経由でエージェントを検索
 * - execute_agent: x402決済付きでエージェントを実行
 * - ストリーミング対応
 */

import { initChatModel, createAgent } from 'langchain';
import type { AgentRequest, AgentResponse, ExecutionLogEntry } from '@agent-marketplace/shared';
import { discoverAgentsTool, executeAgentTool } from '../tools/index.js';
import { logger, logStep, logSeparator } from '../utils/logger.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';

/**
 * エージェントを実行（非ストリーミング）
 */
export async function runAgent(request: AgentRequest): Promise<AgentResponse> {
  const { message, walletId, walletAddress, maxBudget, agentId } = request;
  const executionLog: ExecutionLogEntry[] = [];
  let totalCost = 0;
  let stepCounter = 0;

  logSeparator('Agent Execution Start');
  logger.agent.info('Received request', { message, walletId, walletAddress, maxBudget, agentId });

  executionLog.push({
    step: ++stepCounter,
    type: 'llm',
    action: 'Request received',
    details: { message, maxBudget },
    timestamp: new Date(),
  });

  try {
    const model = await initChatModel('claude-sonnet-4-5-20250929', { temperature: 0 });

    // @ts-ignore - Type instantiation is excessively deep (TS2589)
    const agent = createAgent({
      model,
      tools: [discoverAgentsTool, executeAgentTool],
      systemPrompt: SYSTEM_PROMPT,
    });

    // シンプルなユーザーメッセージ（システムプロンプトに詳細な指示があるため）
    const userMessage = agentId
      ? `${message}\n\n[Context: walletId=${walletId}, walletAddress=${walletAddress}, maxBudget=${maxBudget} USDC, agentId=${agentId}]`
      : `${message}\n\n[Context: walletId=${walletId}, walletAddress=${walletAddress}, maxBudget=${maxBudget} USDC]`;

    logStep(stepCounter, 'llm', 'Starting ReAct agent loop');

    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        context: { agentId },
      }
    );

    // メッセージからログを抽出（メッセージオブジェクトから直接プロパティにアクセス）
    for (const msg of result.messages) {
      const toolCalls = (msg as any).tool_calls || [];
      const name = (msg as any).name || '';
      const content = (msg as any).content || '';
      
      // AIメッセージ（ツール呼び出しを含む可能性）
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          stepCounter++;
          logStep(stepCounter, 'mcp', `Tool call: ${toolCall.name}`);
          logger.mcp.info('Tool arguments', toolCall.args);

          executionLog.push({
            step: stepCounter,
            type: toolCall.name === 'execute_agent' ? 'payment' : 'logic',
            action: `Tool: ${toolCall.name}`,
            details: toolCall.args,
            timestamp: new Date(),
          });
        }
      }

      // ツール結果メッセージ
      if (name && content) {
        try {
          const parsed = JSON.parse(content) as { paymentAmount?: number };
          if (parsed.paymentAmount) {
            totalCost += parsed.paymentAmount;
            logger.payment.success(`Payment: $${parsed.paymentAmount} USDC`, {
              totalCost,
              remainingBudget: maxBudget - totalCost,
            });
          }
        } catch {
          // JSON解析失敗は無視
        }
      }
    }

    // 最終レスポンスを取得（メッセージオブジェクトから直接contentを取得）
    const lastMessage = result.messages[result.messages.length - 1];
    const finalResponse = (lastMessage as any).content || 'タスクが完了しました。';

    stepCounter++;
    logStep(stepCounter, 'llm', 'Agent execution completed');

    executionLog.push({
      step: stepCounter,
      type: 'llm',
      action: 'Execution completed',
      details: { totalCost },
      timestamp: new Date(),
    });

    logSeparator('Agent Execution End');
    logger.agent.success('Total cost', { totalCost, remainingBudget: maxBudget - totalCost });

    return {
      success: true,
      message: typeof finalResponse === 'string' ? finalResponse : JSON.stringify(finalResponse),
      executionLog,
      totalCost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Agent execution failed', { error: errorMessage });

    executionLog.push({
      step: ++stepCounter,
      type: 'error',
      action: 'Execution failed',
      details: { error: errorMessage },
      timestamp: new Date(),
    });

    logSeparator('Agent Execution End (Error)');

    return {
      success: false,
      message: '',
      executionLog,
      totalCost,
      error: errorMessage,
    };
  }
}
