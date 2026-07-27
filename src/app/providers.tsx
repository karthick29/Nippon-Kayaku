'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/components/shell/ThemeProvider';

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created in state so it survives
  // re-renders but is never shared between server requests.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          closeButton
          toastOptions={{
            style: {
              background: 'var(--vbds-surface)',
              color: 'var(--vbds-text)',
              border: '1px solid var(--vbds-border)',
              borderRadius: 'var(--vbds-radius-input)',
              boxShadow: 'var(--vbds-shadow-overlay)',
              fontFamily: 'var(--vbds-font)',
              fontSize: 'var(--vbds-body-size)',
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
