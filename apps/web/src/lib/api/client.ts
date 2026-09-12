import type { ApiEnvelope, ApiErrorBody, ApiErrorCode, ApiFieldError } from '@flowdesk/types';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?: ApiFieldError[];
  readonly traceId?: string;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
    this.traceId = body.traceId;
  }

  get isAuth(): boolean {
    return this.code === 'unauthorized';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
  /** skip the Authorization header (used by the refresh call itself) */
  anonymous?: boolean;
}

type TokenProvider = () => string | null;
type RefreshHandler = () => Promise<boolean>;

let getToken: TokenProvider = () => null;
let onRefresh: RefreshHandler = async () => false;
let refreshInFlight: Promise<boolean> | null = null;

export function configureApiClient(opts: { getToken: TokenProvider; onRefresh: RefreshHandler }): void {
  getToken = opts.getToken;
  onRefresh = opts.onRefresh;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function raw<T>(path: string, options: RequestOptions, retryOn401 = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = options.anonymous ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let bodyInit: BodyInit | undefined;
  if (options.body instanceof FormData) {
    bodyInit = options.body;
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    bodyInit = JSON.stringify(options.body);
  }

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: bodyInit,
    credentials: 'include',
    signal: options.signal,
  });

  if (res.status === 401 && retryOn401 && !options.anonymous) {
    refreshInFlight ??= onRefresh().finally(() => {
      refreshInFlight = null;
    });
    const ok = await refreshInFlight;
    if (ok) return raw<T>(path, options, false);
  }

  if (res.status === 204) return undefined as T;

  const payload = (await res.json().catch(() => null)) as ApiEnvelope<T> | ApiErrorBody | null;

  if (!res.ok || !payload) {
    const errBody =
      payload && 'error' in payload
        ? payload.error
        : { code: 'internal_error' as ApiErrorCode, message: 'Unexpected error. Please try again.' };
    throw new ApiError(res.status, errBody);
  }

  return (payload as ApiEnvelope<T>).data;
}

export const api = {
  get: <T>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    raw<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    raw<T>(path, { ...opts, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    raw<T>(path, { ...opts, method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method'> = {}) =>
    raw<T>(path, { ...opts, method: 'PUT', body }),
  delete: <T>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    raw<T>(path, { ...opts, method: 'DELETE' }),
};
