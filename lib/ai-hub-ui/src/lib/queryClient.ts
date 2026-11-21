import { QueryClient, type QueryFunction } from "@tanstack/react-query";

/** One immutable data adapter per artifact; no global API namespace switching. */
export function createHubDataClient(apiBasePath: string) {
  const base = apiBasePath.replace(/\/$/, "");

  function apiUrl(url: string) {
    if (url === "/api/hub" || url.startsWith("/api/hub/")) {
      return `${base}${url.slice("/api/hub".length)}`;
    }
    return url.startsWith("/api/") ? `${base}/${url.slice("/api/".length)}` : url;
  }

  async function throwIfResNotOk(res: Response) {
    if (!res.ok) throw new Error(`${res.status}: ${(await res.text()) || res.statusText}`);
  }

  async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
    const res = await fetch(apiUrl(url), {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include",
    });
    await throwIfResNotOk(res);
    return res;
  }

  const getQueryFn: <T>(options: {
    on401: "returnNull" | "throw";
  }) => QueryFunction<T> = ({ on401 }) => async ({ queryKey }) => {
    const res = await fetch(apiUrl(queryKey.join("/") as string), { credentials: "include" });
    if (on401 === "returnNull" && res.status === 401) return null;
    await throwIfResNotOk(res);
    return await res.json();
  };

  function createQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: {
          queryFn: getQueryFn({ on401: "throw" }),
          refetchInterval: false,
          refetchOnWindowFocus: false,
          staleTime: Infinity,
          retry: false,
        },
        mutations: { retry: false },
      },
    });
  }

  return { apiRequest, getQueryFn, createQueryClient, apiUrl };
}

export type HubDataClient = ReturnType<typeof createHubDataClient>;
