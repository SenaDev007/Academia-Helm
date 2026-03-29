import { QueryClient } from '@tanstack/react-query';

/**
 * Options par défaut — alignées avec une app « data-heavy » (Helm) :
 * - cache lecture raisonnable, pas de refetch agressif au focus
 * - mutations sans retry automatique (évite doubles POST ; gérer au cas par cas)
 */
const defaultOptions = {
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
};

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return new QueryClient(defaultOptions);
  }
  if (!browserQueryClient) {
    browserQueryClient = new QueryClient(defaultOptions);
  }
  return browserQueryClient;
}
