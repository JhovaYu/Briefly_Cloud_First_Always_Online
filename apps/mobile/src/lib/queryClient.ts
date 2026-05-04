import { QueryClient, focusManager } from '@tanstack/react-query';
import { AppState } from 'react-native';

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

// React Native focus manager — proper TanStack Query pattern for RN
focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      handleFocus(true);
    }
  });
  return () => subscription.remove();
});
