/**
 * @module lib/a2a/message
 * A2A プロトコル準拠の JSON-RPC リクエストを構築するユーティリティ。
 */

import type { JsonRpcRequest, A2APart, A2AMessageSendParams } from '@agent-marketplace/shared';

/**
 * A2A message/send 用の JSON-RPC リクエストを構築する。
 * task は TextPart、data は DataPart としてそれぞれ追加される。
 * 少なくとも一方は必須。
 *
 * @param task - 自然言語テキスト入力（TextPart）
 * @param data - 構造化パラメータ（DataPart）
 * @returns JSON-RPC 2.0 準拠のリクエストオブジェクト
 * @throws task も data も指定されていない場合
 */
export function createJsonRpcRequest(
  task?: string,
  data?: Record<string, unknown>,
): JsonRpcRequest {
  const parts: A2APart[] = [];

  if (task) {
    parts.push({ kind: 'text', text: task });
  }

  if (data && Object.keys(data).length > 0) {
    parts.push({ kind: 'data', data });
  }

  if (parts.length === 0) {
    throw new Error('A2A request requires at least one Part (task or data)');
  }

  const params: A2AMessageSendParams = {
    message: {
      role: 'user',
      parts,
      messageId: crypto.randomUUID(),
    },
  };

  return {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'message/send',
    params,
  };
}
