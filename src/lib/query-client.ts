import { QueryClient } from "@tanstack/react-query";

function shouldRetry(failureCount: number, error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  if (status === 401 || status === 403) return false;
  return failureCount < 2;
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetry,
      },
    },
  });
}
