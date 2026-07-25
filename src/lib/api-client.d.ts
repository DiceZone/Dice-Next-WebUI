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
export declare class ApiError extends Error {
    readonly code: number;
    readonly responseMessage: string;
    constructor(code: number, message: string);
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
declare function getApiKey(): string | null;
declare function setApiKey(key: string): void;
declare function clearApiKey(): void;
export declare const apiClient: {
    /** GET request */
    get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<ApiResponse<T>>;
    /** POST request */
    post<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<ApiResponse<T>>;
    /** PUT request */
    put<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<ApiResponse<T>>;
    /** PATCH request */
    patch<T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, "method">): Promise<ApiResponse<T>>;
    /** DELETE request (supports optional body for bulk/key-based deletes) */
    delete<T>(endpoint: string, options?: Omit<RequestOptions, "method">): Promise<ApiResponse<T>>;
    getApiKey: typeof getApiKey;
    setApiKey: typeof setApiKey;
    clearApiKey: typeof clearApiKey;
};
export default apiClient;
