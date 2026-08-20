import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a fresh QueryClient with sensible defaults for this app.
 * Call once per render root (see app/root.tsx) so state is never shared
 * between SSR requests or hydration boundaries.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000, // data stays fresh for 1 minute
        gcTime: 5 * 60_000, // unused queries are garbage-collected after 5 minutes
        retry: 1, // one automatic retry on transient failures
        refetchOnWindowFocus: false, // avoid surprise network churn while tabbing
      },
      mutations: {
        retry: 0, // never auto-retry mutations (login, create, ...)
      },
    },
  });
}
