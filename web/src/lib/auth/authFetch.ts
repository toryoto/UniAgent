/**
 * Privy の認証トークンを Authorization ヘッダーに付与して fetch を実行する。
 * getAccessToken はリフレッシュ済みトークンを返すため、
 * 呼び出し元で有効期限管理する必要はない。
 */
export async function authFetch(
  url: string,
  getAccessToken: () => Promise<string | null>,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
