'use client';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * URL-backed list state (q / page / sort / order / filters) for the big
 * server-paginated tables. The URL is the single source of truth so state
 * survives refresh and back/forward navigation.
 *
 * `setParams` merges a patch into the current query string via
 * `router.replace` (no history spam, no scroll jump). Passing `null`/`''`
 * removes a key, keeping defaults out of the URL.
 *
 * Callers use `useSearchParams`, so pages must render under a `<Suspense>`
 * boundary or `next build` fails prerendering.
 */
export function useUrlListParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, pathname, router]);

  return { searchParams, setParams };
}

/** Parse a 1-based page number from a query-string value. */
export function parsePageParam(value: string | null): number {
  const n = parseInt(value ?? '1', 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
