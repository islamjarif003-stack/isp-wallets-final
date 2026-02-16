const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const inFlightGet = new Map<string, Promise<any>>();

interface ApiOptions {
  method?: string;
  body?: any;
  token?: string;
  params?: Record<string, string>;
}

export async function api<T = any>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, token, params } = options;

  let url = `${API_URL}${endpoint}`;
  if (params) {
    const sp = new URLSearchParams(params);
    url += `?${sp.toString()}`;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const canDedupe = method === 'GET' && !body;
  const dedupeKey = canDedupe ? `${method}:${url}:${headers['Authorization'] || ''}` : '';

  const run = async (): Promise<T> => {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store',
      });
    } catch {
      throw new ApiError(
        `Failed to fetch. Check NEXT_PUBLIC_API_URL (${API_URL}) and backend CORS.`,
        0,
        null
      );
    }

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const message =
        typeof data === 'object' && data && 'message' in data
          ? String((data as any).message)
          : 'Request failed';
      throw new ApiError(message, res.status, data);
    }

    return data as T;
  };

  if (canDedupe) {
    const existing = inFlightGet.get(dedupeKey);
    if (existing) return existing as Promise<T>;
    const p = run().finally(() => {
      inFlightGet.delete(dedupeKey);
    });
    inFlightGet.set(dedupeKey, p);
    return p;
  }

  return run();
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function setTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem('admin_token', accessToken);
  localStorage.setItem('admin_refresh_token', refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
}
