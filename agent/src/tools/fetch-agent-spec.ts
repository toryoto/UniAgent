/**
 * @module tools/fetch-agent-spec
 * LangChain fetch_agent_spec ツール定義。
 * 外部エージェントの agent.json と OpenAPI spec を取得し、
 * LLM が実行前に仕様を確認するために使用する。コストフリー。
 */

import { tool } from 'langchain';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { fetchAgentJson, fetchOpenApiSpec } from '../lib/a2a/agent-json.js';
import { resolveAgentUrlFromAgentId } from '../lib/a2a/resolve-url.js';

// ── Public ────────────────────────────────────────────────────────────────

const fetchAgentSpecSchema = z.object({
  agentId: z
    .string()
    .describe('エージェントID（discover_agents の結果から取得）'),
});

/**
 * fetch_agent_spec ツール。
 * エージェントの詳細仕様（agent.json + OpenAPI spec）を取得する。
 */
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

      const agentJson = await fetchAgentJson(agentUrl);
      if (!agentJson) {
        return JSON.stringify({
          success: false,
          error: `agent.json を取得できませんでした: ${agentUrl}`,
        });
      }

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
      return JSON.stringify({ success: false, error: message });
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
  },
);
