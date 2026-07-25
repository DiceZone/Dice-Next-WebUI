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

/** HTTP methods supported by the API client. */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Options for individual API requests. */
interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Skip attaching the API key (for public endpoints). */
  noAuth?: boolean;
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

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new ApiError(0, `Network error: ${(err as Error).message}`);
  }

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
    // If the response isn't in the standard envelope, wrap it
    return {
      code: 0,
      message: 'success',
      data: rawBody as T,
    };
  }

  const envelope = rawBody as ApiResponse<T>;

  // Check application-level error codes
  if (envelope.code !== 0) {
    throw new ApiError(envelope.code, envelope.message);
  }

  return envelope;
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
