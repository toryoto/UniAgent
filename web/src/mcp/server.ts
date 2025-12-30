/**
 * A2A Discovery MCP Server
 *
 * Claude API MCP Connector用のエージェント検索MCPサーバー
 * オンチェーンからAgentCardを取得し、.well-known/agent.jsonの情報を併せて返す
 */

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { discoverAgents } from './tools/discover-agents';

// MCPサーバーインスタンス
export const mcpServer = new FastMCP({
  name: 'a2a-discovery',
  version: '1.0.0',
});

// discover_agents ツール
mcpServer.addTool({
  name: 'discover_agents',
  description: `ブロックチェーン上のAgentRegistryからエージェントを検索します。
カテゴリやスキル名で検索可能で、価格・評価でのフィルタリングもサポートしています。
結果にはオンチェーンのAgentCard情報と、各エージェントの.well-known/agent.jsonから取得したA2Aエンドポイント情報が含まれます。`,
  parameters: z.object({
    category: z
      .string()
      .optional()
      .describe('検索するカテゴリ (例: "travel", "finance", "utility")'),
    skillName: z
      .string()
      .optional()
      .describe('検索するスキル名 (部分一致)'),
    maxPrice: z
      .number()
      .optional()
      .describe('最大価格 (USDC)'),
    minRating: z
      .number()
      .min(0)
      .max(5)
      .optional()
      .describe('最小評価 (0-5)'),
  }),
  execute: async (args) => {
    const result = await discoverAgents({
      category: args.category,
      skillName: args.skillName,
      maxPrice: args.maxPrice,
      minRating: args.minRating,
    });

    return JSON.stringify(result, null, 2);
  },
});

// サーバー起動関数（スタンドアロン実行用）
export function startMcpServer(port: number = 3001) {
  mcpServer.start({
    transportType: 'httpStream',
    httpStream: {
      port,
    },
  });

  console.log(`A2A Discovery MCP Server running on port ${port}`);
  console.log(`  SSE endpoint: http://localhost:${port}/sse`);
  console.log(`  HTTP endpoint: http://localhost:${port}/mcp`);
}

// CLIから直接実行された場合
if (require.main === module) {
  const port = parseInt(process.env.MCP_PORT || '3001', 10);
  startMcpServer(port);
}
