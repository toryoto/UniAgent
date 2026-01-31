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

    // ユーザーメッセージにコンテキストを追加
    const userMessage = `
## ユーザーのリクエスト
${message}

## コンテキスト
- wallet_id: ${walletId}
- wallet_address: ${walletAddress}
- max_budget: $${maxBudget} USDC
- 現在の予算使用額: $${totalCost} USDC
- 残り予算: $${maxBudget - totalCost} USDC${
      agentId
        ? `
- 指定エージェントID: ${agentId}
  ※まず discover_agents({ agentId: "${agentId}" }) でエージェント情報を取得してください
  ※そのエージェントがタスクに適している場合のみ execute_agent で実行してください
  ※タスクに合わない場合やタスク遂行するために追加エージェントが必要な場合は、カテゴリやスキル名で discover_agents を再実行してください`
        : ''
    }

## 重要な指示
- discover_agents（検索）はコストフリーなので、必要に応じて積極的に使用してください
- execute_agent（実行）は課金されるため、タスクに適したエージェントのみ実行してください
- エージェントを実行する場合は execute_agent に以下を指定:
  - walletId: "${walletId}"
  - walletAddress: "${walletAddress}"
  - maxPrice: 残り予算の90%以下に設定（安全マージン）
- 各エージェント実行の maxPrice の合計が max_budget を超えないように注意してください
`;

    logStep(stepCounter, 'llm', 'Starting ReAct agent loop');

    const result = await agent.invoke(
      {
        messages: [{ role: 'user', content: userMessage }],
      },
      {
        context: { agentId },
      }
    );

    // メッセージからログを抽出
    for (const msg of result.messages) {
      if (msg._getType() === 'ai') {
        const aiMsg = msg as {
          tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
        };

        // ツール呼び出しをログ
        if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
          for (const toolCall of aiMsg.tool_calls) {
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
      }

      if (msg._getType() === 'tool') {
        const toolMsg = msg as { content: string };
        try {
          const parsed = JSON.parse(toolMsg.content) as { paymentAmount?: number };
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

    // 最終レスポンスを取得
    const lastMessage = result.messages[result.messages.length - 1];
    const finalResponse =
      lastMessage._getType() === 'ai'
        ? (lastMessage as { content: string }).content
        : 'タスクが完了しました。';

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

/**
 * エージェントを実行（ストリーミング）
 */
export async function* runAgentStream(
  request: AgentRequest
): AsyncGenerator<{ type: string; data: unknown }, void, unknown> {
  const { message, walletId, walletAddress, maxBudget, agentId } = request;
  let totalCost = 0;
  let stepCounter = 0;

  yield { type: 'start', data: { message, maxBudget } };

  try {
    const model = await initChatModel('claude-sonnet-4-5-20250929', { temperature: 0 });

    // @ts-ignore - Type instantiation is excessively deep (TS2589)
    const agent = createAgent({
      model,
      tools: [discoverAgentsTool, executeAgentTool],
      systemPrompt: SYSTEM_PROMPT,
    });

    const userMessage = `
## ユーザーのリクエスト
${message}

## コンテキスト
- wallet_id: ${walletId}
- wallet_address: ${walletAddress}
- max_budget: $${maxBudget} USDC
- 現在の予算使用額: $${totalCost} USDC
- 残り予算: $${maxBudget - totalCost} USDC${
      agentId
        ? `
- 指定エージェントID: ${agentId}
  ※まず discover_agents({ agentId: "${agentId}" }) でエージェント情報を取得してください
  ※そのエージェントがタスクに適している場合のみ execute_agent で実行してください
  ※タスクに合わない場合や追加エージェントが必要な場合は、カテゴリやスキル名で discover_agents を再実行してください`
        : ''
    }

## 重要な指示
- discover_agents（検索）はコストフリーなので、必要に応じて積極的に使用してください
- execute_agent（実行）は課金されるため、タスクに適したエージェントのみ実行してください
- エージェントを実行する場合は execute_agent に以下を指定:
  - walletId: "${walletId}"
  - walletAddress: "${walletAddress}"
  - maxPrice: 残り予算の90%以下に設定（安全マージン）
`;

    yield {
      type: 'log',
      data: {
        step: ++stepCounter,
        type: 'llm',
        action: 'Starting agent',
        timestamp: new Date(),
      },
    };

    const stream = await agent.stream({
      messages: [{ role: 'user', content: userMessage }],
      ...(agentId ? { agentId } : {}),
    });

    for await (const chunk of stream) {
      // ストリームチャンクを処理
      if (typeof chunk === 'object' && chunk !== null && 'messages' in chunk) {
        const chunkRecord = chunk as Record<string, unknown>;
        const messages = Array.isArray(chunkRecord.messages) ? chunkRecord.messages : [];
        for (const msg of messages) {
          if (typeof msg === 'object' && msg !== null && '_getType' in msg) {
            const msgType = (msg as { _getType: () => string })._getType();

            if (msgType === 'ai') {
              const aiMsg = msg as {
                content?: string;
                tool_calls?: Array<{ name: string; args: Record<string, unknown> }>;
              };

              // テキストコンテンツをストリーミング
              if (aiMsg.content) {
                yield { type: 'content', data: { text: aiMsg.content } };
              }

              // ツール呼び出しを通知
              if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
                for (const toolCall of aiMsg.tool_calls) {
                  stepCounter++;
                  yield {
                    type: 'tool_call',
                    data: {
                      step: stepCounter,
                      tool: toolCall.name,
                      args: toolCall.args,
                    },
                  };
                }
              }
            }

            if (msgType === 'tool') {
              const toolMsg = msg as unknown as { content: string };
              try {
                const parsed = JSON.parse(toolMsg.content) as {
                  paymentAmount?: number;
                  success?: boolean;
                };

                // 決済情報を処理
                if (parsed.paymentAmount) {
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
              } catch {
                // JSON解析失敗は無視
              }
            }
          }
        }
      }
    }

    yield {
      type: 'end',
      data: {
        success: true,
        totalCost,
        remainingBudget: maxBudget - totalCost,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.agent.error('Streaming execution failed', { error: errorMessage });
    yield { type: 'error', data: { error: errorMessage } };
  }
}
