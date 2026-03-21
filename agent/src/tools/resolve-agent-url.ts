/**
 * agentId → Base URL（agent.json のルート）
 * discover_agents / fetch_agent_spec と同じ AgentCache を正とする。
 */

import { discoverAgents } from '@agent-marketplace/database';

export async function resolveAgentUrlFromAgentId(agentId: string): Promise<string | null> {
  const result = await discoverAgents({ agentId });
  const agent = result.agents[0];
  return agent?.url || null;
}
