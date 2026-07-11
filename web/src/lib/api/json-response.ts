/**
 * @module lib/api/json-response
 * API Route / オーケストレータ共通の JSON レスポンス生成ヘルパー。
 */

export function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
