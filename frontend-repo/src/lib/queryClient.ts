import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_URL } from "@/config/api";

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// Build full URL from path
function buildUrl(path: string): string {
  // If already absolute, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // If starts with /api, use API_URL base
  if (path.startsWith('/api')) {
    return `${API_URL}${path.substring(4)}`;
  }
  // Otherwise prepend API_URL
  return `${API_URL}${path}`;
}

// Main API request function - simplified single signature
export async function apiRequest(
  method: string,
  path: string,
  data?: unknown
): Promise<Response> {
  const url = buildUrl(path);
  const headers: Record<string, string> = {};

  // Add authentication headers
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let body: any = undefined;

  // Handle different data types
  if (data) {
    if (data instanceof FormData) {
      // For FormData, don't set Content-Type (browser will set it with boundary)
      body = data;
    } else {
      // For JSON data
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Default query function for TanStack Query
type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const path = queryKey[0] as string;
    const url = buildUrl(path);
    const headers: Record<string, string> = {};

    // Add authentication headers
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(url, {
      headers,
      credentials: "include",
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
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
