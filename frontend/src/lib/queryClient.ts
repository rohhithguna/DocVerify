import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Get the stored JWT token from sessionStorage.
 * Falls back to localStorage once for backward compatibility.
 */
function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const key = "docutrust_token";
  const sessionToken = sessionStorage.getItem(key);
  if (sessionToken) return sessionToken;

  const legacyToken = localStorage.getItem(key);
  if (legacyToken) {
    sessionStorage.setItem(key, legacyToken);
    localStorage.removeItem(key);
    return legacyToken;
  }

  return null;
}

/**
 * Build headers with optional auth token and content type.
 */
function buildHeaders(includeJson: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (includeJson) headers["Content-Type"] = "application/json";
  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let payload: any = null;
    let text = "";

    try {
      payload = await res.clone().json();
    } catch {
      text = (await res.text()) || "";
    }

    const errorMessage =
      payload?.error ||
      payload?.message ||
      text ||
      res.statusText ||
      "Request failed";

    throw new Error(`${res.status}: ${errorMessage}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: buildHeaders(!!data),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

export async function apiRequestMultipart(
  method: string,
  url: string,
  formData: FormData,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: buildHeaders(false), // Don't set Content-Type for FormData
    body: formData,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: buildHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 60000,
      gcTime: 300000,
      retry: (failureCount) => failureCount < 2,
    },
    mutations: {
      retry: (failureCount) => failureCount < 1,
    },
  },
});
