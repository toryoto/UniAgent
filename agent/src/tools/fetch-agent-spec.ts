/**
 * Fetch Agent Spec Tool
 *
 * 外部エージェントの agent.json と OpenAPI spec を取得する LangChain ツール。
 * LLM が実行前にエージェントの仕様を確認し、適切なリクエストを構築するために使用。
 * コストフリー（課金なし）。
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { fetchAgentJson } from './agent-utils.js';
import { AGENT_JSON_TIMEOUT_MS } from './constants.js';
import { resolveAgentUrlFromAgentId } from './resolve-agent-url.js';

const fetchAgentSpecSchema = z.object({
  agentId: z
    .string()
    .describe('エージェントID（discover_agents の結果から取得）'),
});

/**
 * OpenAPI spec を URL からフェッチする
 */
async function fetchOpenApiSpec(specUrl: string): Promise<unknown | null> {
  try {
    logger.logic.info('Fetching OpenAPI spec', { url: specUrl });

    const response = await fetch(specUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(AGENT_JSON_TIMEOUT_MS),
    });

    if (!response.ok) {
      logger.logic.warn('OpenAPI spec not found', { status: response.status });
      return null;
    }

    const spec = await response.json();
    logger.logic.success('Got OpenAPI spec');
    return spec;
  } catch (error) {
    logger.logic.warn('Failed to fetch OpenAPI spec', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return null;
  }
}

export const fetchAgentSpecTool = tool(
  async (input: z.infer<typeof fetchAgentSpecSchema>) => {
    try {
      logger.logic.info('Fetching agent spec', { agentId: input.agentId });

      const agentUrl = await resolveAgentUrlFromAgentId(input.agentId);
      if (!agentUrl) {
        return JSON.stringify({
          success: false,
          error: `agentId に対応するエージェントURLを取得できませんでした: ${input.agentId}`,
        });
      }

      // 1. agent.json を取得
      const agentJson = await fetchAgentJson(agentUrl);
      if (!agentJson) {
        return JSON.stringify({
          success: false,
          error: `agent.json を取得できませんでした: ${agentUrl}`,
        });
      }

      // 2. OpenAPI spec があればフェッチ
      let openApiSpec = null;
      const specUrl = agentJson.endpoints?.[0]?.spec;
      if (specUrl) {
        openApiSpec = await fetchOpenApiSpec(specUrl);
      }

      logger.logic.success('Agent spec fetched', {
        name: agentJson.name,
        hasOpenApi: !!openApiSpec,
      });

      return JSON.stringify({
        success: true,
        agentSpec: {
          agentId: input.agentId,
          agentUrl,
          agentJson,
          openApiSpec: openApiSpec ?? undefined,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.logic.error('fetch_agent_spec failed', { error: message });
      return JSON.stringify({
        success: false,
        error: message,
      });
    }
  },
  {
    name: 'fetch_agent_spec',
    description: `外部エージェントの詳細仕様（agent.json + OpenAPI spec）を取得します。
discover_agents で見つけたエージェントの実行前に、以下を確認するために使用:
- skills（対応スキル一覧）
- defaultInputModes / defaultOutputModes（入出力形式）
- endpoints（エンドポイント情報）
- payment（支払い情報の詳細）
- OpenAPI spec（リクエスト/レスポンスの具体的な形式）
入力には discover_agents の結果の agentId を使用する。
コストフリーなので積極的に使ってください。`,
    schema: fetchAgentSpecSchema,
  }
);
