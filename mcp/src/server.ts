/**
 * A2A Discovery MCP Server
 *
 * Claude API MCP Connector用のエージェント検索MCPサーバー
 * オンチェーンからAgentCardを取得し、.well-known/agent.jsonの情報を併せて返す
 */

import 'dotenv/config';
import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { discoverAgents } from './tools/discover-agents.js';

// MCPサーバーインスタンス
export const mcpServer = new FastMCP({
  name: 'a2a-discovery',
  version: '1.0.0',
});

// discover_agents ツール
mcpServer.addTool({
  name: 'discover_agents',
  description: `ブロックチェーン上のAgent Identity Registry (ERC-8004) からエージェントを検索します。
カテゴリやスキル名で検索可能で、価格・評価でのフィルタリングもサポートしています。
結果にはオンチェーンのエージェント情報と、各エージェントの.well-known/agent.jsonから取得したA2Aエンドポイント・価格情報が含まれます。`,
  parameters: z.object({
    category: z
      .string()
      .optional()
      .describe('検索するカテゴリ (例: "travel", "finance", "utility")'),
    skillName: z.string().optional().describe('検索するスキル名 (部分一致)'),
    maxPrice: z.number().optional().describe('最大価格 (USDC)'),
    minRating: z.number().min(0).max(5).optional().describe('最小評価 (0-5)'),
  }),
  execute: async (args) => {
    console.log('[discover_agents] Tool execution started');
    console.log('[discover_agents] Parameters:', JSON.stringify(args));

    try {
      const result = await discoverAgents({
        category: args.category,
        skillName: args.skillName,
        maxPrice: args.maxPrice,
        minRating: args.minRating,
      });

      console.log(`[discover_agents] Tool execution completed: ${result.total} agents found`);

      console.log('[discover_agents] Response details:', JSON.stringify(result, null, 2));

      return JSON.stringify(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[discover_agents] Tool execution failed:', errorMessage);
      console.error('[discover_agents] Error details:', error);
      throw new Error(`エージェント検索中にエラーが発生しました: ${errorMessage}`);
    }
  },
});

// サーバー起動関数（スタンドアロン実行用）
export function startMcpServer(port: number = 3001) {
  mcpServer.start({
    transportType: 'httpStream',
    httpStream: {
      port,
      host: '0.0.0.0',
    },
  });

  console.log(`A2A Discovery MCP Server running on 0.0.0.0:${port}`);
  console.log(`  SSE endpoint: http://0.0.0.0:${port}/sse`);
  console.log(`  HTTP endpoint: http://0.0.0.0:${port}/mcp`);
}

// サーバー起動
const port = parseInt(process.env.MCP_PORT || '3001', 10);
console.log(
  `[MCP Server] Starting on port ${port} (Railway PORT: ${process.env.PORT}, MCP_PORT: ${process.env.MCP_PORT})`
);
startMcpServer(port);
