// =============================================================================
// API CLIENT
// =============================================================================
// A thin wrapper around fetch that:
//   1. Prefixes all requests with the API base URL
//   2. Always sends cookies (credentials: "include") — required for HttpOnly
//      JWT cookies to be sent cross-origin to the Fastify API
//   3. Sets Content-Type: application/json on all requests
//   4. Parses JSON responses automatically
//   5. Throws a structured ApiError on non-2xx responses so SWR and
//      mutation handlers can catch and display errors consistently
//
// All other files import from here instead of calling fetch directly.
// This means if the API base URL changes, or we need to add a global header,
// there is one place to update.
// =============================================================================

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

// Structured error that includes the HTTP status and the error code
// returned by the API (e.g. "PLAYER_NOT_FOUND", "INVALID_CREDENTIALS")
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      // No default Content-Type here — each method sets it only when needed
      ...options?.headers,
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data.error ?? "UNKNOWN_ERROR",
      data.message ?? "An unexpected error occurred"
    );
  }

  return data as T;
}

// Convenience methods
export const api = {
  get: <T>(path: string) =>
    request<T>(path, { method: "GET" }),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { "Content-Type": "application/json" } : {},
    }),

  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};
