let memoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  memoryToken = token;
}

export function getAuthToken(): string | null {
  return memoryToken;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<{ data?: T; error?: string; status: number }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (memoryToken) {
    headers.Authorization = `Bearer ${memoryToken}`;
  }

  try {
    const res = await fetch(path, {
      method: options.method || 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        error: typeof json?.error === 'string' ? json.error : `Request failed (${res.status})`,
        status: res.status,
      };
    }
    return { data: json as T, status: res.status };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Network error communicating with server.',
      status: 0,
    };
  }
}
