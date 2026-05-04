import { QueryClient } from '@tanstack/react-query';
import { AppState, AppStateStatus } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,       // 5 minutes
      gcTime: 1000 * 60 * 30,          // 30 minutes (was cacheTime in v4)
      retry: 2,
      refetchOnMount: true,
      refetchOnReconnect: true,
    },
  },
});

// React Native focus manager — refetch when app comes to foreground
let appStateSubscription: { remove: () => void } | null = null;

function handleAppStateChange(nextState: AppStateStatus) {
  if (nextState === 'active') {
    queryClient.invalidateQueries();
  }
}

AppState.addEventListener('change', handleAppStateChange);
