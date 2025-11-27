import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { API_URL } from "@/config/api";

// Get auth token from localStorage
function getAuthToken(): string | null {
  return localStorage.getItem('accessToken');
}

// Helper to build full URL
function buildFullUrl(url: string): string {
  // If URL is already absolute, return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  // If URL starts with /api, prepend the base URL
  if (url.startsWith('/api')) {
    return `${API_URL}${url.substring(4)}`; // Remove /api prefix since API_URL already includes it
  }
  // Otherwise prepend API_URL
  return `${API_URL}${url}`;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response>;

export async function apiRequest<T>(
  url: string,
  options?: RequestInit
): Promise<T>;

export async function apiRequest(
  methodOrUrl: string,
  urlOrOptions?: string | RequestInit,
  data?: unknown
): Promise<Response | any> {
  // Handle overload cases
  let method: string;
  let url: string;
  let requestData: unknown | undefined;
  let isTypedRequest = false;

  if (urlOrOptions && typeof urlOrOptions === 'string') {
    // First overload: (method, url, data?)
    method = methodOrUrl;
    url = urlOrOptions;
    requestData = data;
  } else {
    // Second overload: <T>(url, options?)
    method = (urlOrOptions as RequestInit)?.method || 'GET';
    url = methodOrUrl;
    requestData = (urlOrOptions as RequestInit)?.body;
    isTypedRequest = true;
  }

  const headers: Record<string, string> = requestData ? { "Content-Type": "application/json" } : {};

  // Add authentication headers
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = buildFullUrl(url);

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: requestData ? JSON.stringify(requestData) : undefined,
    credentials: "include",
    ...(urlOrOptions && typeof urlOrOptions !== 'string' ? urlOrOptions : {})
  });

  await throwIfResNotOk(res);
  
  // If it's a typed request, return JSON parsed
  if (isTypedRequest) {
    return await res.json();
  }
  
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};

    // Add authentication headers
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = queryKey.join("/") as string;
    const fullUrl = buildFullUrl(url);

    const res = await fetch(fullUrl, {
      headers,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Helper function for authenticated fetch calls
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Add authentication headers
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fullUrl = buildFullUrl(url);

  return fetch(fullUrl, {
    ...options,
    headers,
    credentials: 'include'
  });
}

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
