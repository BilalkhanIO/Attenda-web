'use client';
import { ReactNode, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getApiError } from './utils';

/**
 * Single QueryClient for the app. Errors surface through one global toast
 * handler — pages opt out with meta: { silent: true } when they render the
 * error themselves.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
          },
        },
        queryCache: new QueryCache({
          onError: (err, query) => {
            if (query.meta?.silent) return;
            toast.error(getApiError(err));
          },
        }),
        mutationCache: new MutationCache({
          onError: (err, _vars, _ctx, mutation) => {
            if (mutation.meta?.silent) return;
            toast.error(getApiError(err));
          },
        }),
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
