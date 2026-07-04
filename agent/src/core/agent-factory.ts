/**
 * @module core/agent-factory
 * LangGraph エージェント生成の一元化。
 * モデル・tools・HITL ミドルウェア・checkpointer の構成はここだけで定義し、
 * 実行系（agent-streaming / stream-processor）は本モジュール経由で agent を取得する。
 */

import { initChatModel, createAgent, humanInTheLoopMiddleware } from 'langchain';
import { MemorySaver } from '@langchain/langgraph';
import { AGENT_MODEL } from '../config/constants.js';
import { SYSTEM_PROMPT } from '../prompts/system-prompt.js';
import {
  discoverAgentsTool,
  executeAndEvaluateAgentTool,
  fetchAgentSpecTool,
} from '../tools/index.js';

/**
 * HITL の対象は課金を伴う execute_and_evaluate_agent のみ。
 * 閾値以下の自動承認判定は core/auto-approve が行う（ここでは常に interrupt させる）。
 */
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

/**
 * HITL resume に必要な thread 状態を保持する checkpointer。
 * in-memory のためプロセス再起動で失われる（thread-cost-store と同じライフサイクル）。
 */
const checkpointer = new MemorySaver();

// createAgent の戻り値型は TS2589 (excessively deep) を誘発するため any で保持する
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let agentInstance: any = null;

/**
 * 本番実行経路の LangGraph エージェント（シングルトン）を返す。
 * 初回呼び出し時にモデルを初期化し、以降はキャッシュを再利用する。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getAgent(): Promise<any> {
  if (agentInstance) return agentInstance;
  const model = await initChatModel(AGENT_MODEL, { temperature: 0 });
  agentInstance = createAgent({
    model,
    tools: [discoverAgentsTool, fetchAgentSpecTool, executeAndEvaluateAgentTool],
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
    middleware: [hitlMiddleware],
  });
  return agentInstance;
}
