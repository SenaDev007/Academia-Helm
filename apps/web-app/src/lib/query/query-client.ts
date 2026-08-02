import { QueryClient } from '@tanstack/react-query';

/**
 * Options par défaut — optimisées pour performance maximale :
 * - staleTime 5 min (les données restent fraîches plus longtemps)
 * - gcTime 1h (garde les données en cache plus longtemps)
 * - retry 2 (une retry de plus pour les transitoires)
 * - pas de refetch au focus (évite les requêtes inutiles)
 */
const defaultOptions = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,    // 5 minutes (was 1 min)
      gcTime: 60 * 60 * 1000,       // 1 heure (was 30 min)
      retry: 2,                      // 2 retries (was 1)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchOnMount: false,         // Ne pas refetch si données encore fraîches
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
