/**
 * @module lib/a2a/resolve-url
 * agentId から AgentCache を参照し、エージェントのベース URL を解決する。
 */

import { discoverAgents } from '@agent-marketplace/database';

/**
 * agentId を AgentCache (DB) から検索し、対応するベース URL を返す。
 * discover_agents / fetch_agent_spec と同一の AgentCache を正とする。
 *
 * @param agentId - 16進数文字列のエージェント ID
 * @returns ベース URL（agent.json のルート）。見つからない場合は null
 */
export async function resolveAgentUrlFromAgentId(agentId: string): Promise<string | null> {
  const result = await discoverAgents({ agentId });
  const agent = result.agents[0];
  return agent?.url || null;
}
