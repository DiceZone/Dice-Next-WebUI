/**
 * HTTP REST API Client
 *
 * Thin wrapper around the Fetch API that:
 * - Automatically attaches the `X-API-Key` header from localStorage
 * - Unwraps the standard `ApiResponse<T>` envelope
 * - Provides typed response handling
 * - Centralizes error handling
 *
 * Conforms to backend API response format (section 8.1):
 *   { "code": 0, "message": "success", "data": { ... } }
 */

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

/** Error thrown by the API client on non-zero response codes. */
export class ApiError extends Error {
  public readonly code: number;
  public readonly responseMessage: string;

  constructor(code: number, message: string) {
    super(`[${code}] ${message}`);
    this.name = 'ApiError';
    this.code = code;
    this.responseMessage = message;
  }
}

export class ApiTimeoutError extends ApiError {
  constructor() {
    super(408, 'Request timed out; the server operation may still be running.');
    this.name = 'ApiTimeoutError';
  }
}

/** HTTP methods supported by the API client. */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Options for individual API requests. */
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip attaching the API key (for public endpoints). */
  noAuth?: boolean;
  /** Optional timeout, including response-body parsing. Does not cancel server jobs. */
  timeoutMs?: number;
}

// ─── Internal helpers ────────────────────────────────────────

const BASE_URL = '/api';

function getApiKey(): string | null {
  return localStorage.getItem('dice-api-key');
}

function setApiKey(key: string): void {
  localStorage.setItem('dice-api-key', key);
}

function clearApiKey(): void {
  localStorage.removeItem('dice-api-key');
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

// ─── Core request function ───────────────────────────────────

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, noAuth = false } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  // Attach API key unless explicitly skipped
  if (!noAuth) {
    const apiKey = getApiKey();
    if (apiKey) {
      requestHeaders['X-API-Key'] = apiKey;
    }
  }

  const url = `${BASE_URL}${endpoint}`;

  const controller = options.timeoutMs ? new AbortController() : undefined;
  const timeout = options.timeoutMs
    ? setTimeout(() => controller!.abort(), options.timeoutMs) : undefined;
  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller?.signal,
    });

    // Parse the response body
    const rawBody = await parseBody(response);

    // Check HTTP-level errors
    if (!response.ok) {
      const message =
        typeof rawBody === 'object' && rawBody !== null && 'message' in rawBody
          ? String((rawBody as Record<string, unknown>).message)
          : response.statusText;
      throw new ApiError(response.status, message);
    }

    // Ensure the body is an ApiResponse envelope
    if (
      typeof rawBody !== 'object' ||
      rawBody === null ||
      !('code' in rawBody)
    ) {
      return { code: 0, message: 'success', data: rawBody as T };
    }

    const envelope = rawBody as ApiResponse<T>;
    if (envelope.code !== 0) {
      throw new ApiError(envelope.code, envelope.message);
    }
    return envelope;
  } catch (err) {
    if (controller?.signal.aborted) throw new ApiTimeoutError();
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, `Network error: ${(err as Error).message}`);
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

// ─── Convenience methods ─────────────────────────────────────

export const apiClient = {
  /** GET request */
  get<T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) {
    return request<T>(endpoint, { ...options, method: 'GET' });
  },

  /** POST request */
  post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) {
    return request<T>(endpoint, { ...options, method: 'POST', body });
  },

  /** PUT request */
  put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) {
    return request<T>(endpoint, { ...options, method: 'PUT', body });
  },

  /** PATCH request */
  patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method'>) {
    return request<T>(endpoint, { ...options, method: 'PATCH', body });
  },

  /** DELETE request (supports optional body for bulk/key-based deletes) */
  delete<T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) {
    return request<T>(endpoint, { ...options, method: 'DELETE' });
  },

  // ─── API Key management ────────────────────────────────────
  getApiKey,
  setApiKey,
  clearApiKey,
};

export default apiClient;
