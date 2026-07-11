/**
 * @module lib/a2a/agent-json
 * A2A エージェントの agent.json および OpenAPI spec を HTTP で取得するユーティリティ。
 * ビジネスロジックを持たない純粋な HTTP 取得層。
 */

import type { AgentJson } from '@agent-marketplace/shared';
import { createLogger } from '@agent-marketplace/shared/logger';

const log = createLogger('logic');
import { AGENT_JSON_TIMEOUT_MS } from '../../config/constants.js';

// ── Public ────────────────────────────────────────────────────────────────

/**
 * 指定 URL から .well-known/agent.json を取得する。
 * URL が既に agent.json を含む場合はそのまま使用する。
 *
 * @param baseUrl - エージェントのベース URL
 * @returns 取得した AgentJson、失敗時は null
 */
export async function fetchAgentJson(baseUrl: string): Promise<AgentJson | null> {
  try {
    const agentJsonUrl = buildAgentJsonUrl(baseUrl);
    log.info({ url: agentJsonUrl }, 'Fetching agent.json');

    const response = await fetch(agentJsonUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(AGENT_JSON_TIMEOUT_MS),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'agent.json not found');
      return null;
    }

    const agentJson = (await response.json()) as AgentJson;
    log.info({ endpoint: agentJson.endpoints?.[0]?.url }, 'Got agent.json');
    return agentJson;
  } catch (error) {
    log.warn({ err: error }, 'Failed to fetch agent.json');
    return null;
  }
}

/**
 * OpenAPI spec を URL から取得する。
 *
 * @param specUrl - OpenAPI spec の URL
 * @returns パース済みの spec オブジェクト、失敗時は null
 */
export async function fetchOpenApiSpec(specUrl: string): Promise<unknown | null> {
  try {
    log.info({ url: specUrl }, 'Fetching OpenAPI spec');

    const response = await fetch(specUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(AGENT_JSON_TIMEOUT_MS),
    });

    if (!response.ok) {
      log.warn({ status: response.status }, 'OpenAPI spec not found');
      return null;
    }

    const spec = await response.json();
    log.info('Got OpenAPI spec');
    return spec;
  } catch (error) {
    log.warn({ err: error }, 'Failed to fetch OpenAPI spec');
    return null;
  }
}

// ── Private ───────────────────────────────────────────────────────────────

function buildAgentJsonUrl(baseUrl: string): string {
  const normalizedUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return normalizedUrl.includes('/.well-known/agent.json')
    ? normalizedUrl
    : `${normalizedUrl}/.well-known/agent.json`;
}
