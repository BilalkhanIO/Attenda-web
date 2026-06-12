# Attenda-web Improvement Research Report

**Scope:** `/home/user/Attenda-web` — Next.js 16.2 (App Router), React 19.2, Tailwind 4, axios, react-hook-form + zod 4, react-hot-toast, recharts, lucide.
**Date:** 2026-06-11

## Codebase reality check (what was verified, not assumed)

- **33 of 37 `page.tsx` files are `'use client'`**; only `/blog`, `/blog/[slug]`, `/about`, `/privacy` are server components. The app is effectively an SPA hosted in the App Router.
- **`@tanstack/react-query` v5.100 is in `package.json` but never imported anywhere in `src/`** — zero `useQuery`/`QueryClient` usage. It's dead weight today (or a signal someone intended to adopt it).
- **Every data page hand-rolls `useState` + `useEffect` + `useCallback` fetchers** (e.g. `src/app/leave/page.tsx:67-80`, `src/app/employees/page.tsx:53-70`, `src/app/dashboard/page.tsx:63-84`). After every approve/reject the whole list is refetched (`fetchRequests()` calls in `onApprove`/`onReject`).
- **Dashboard polls with a bare `setInterval(fetchLive, 60_000)`** (`dashboard/page.tsx:80-84`) — keeps polling in background tabs, no dedupe, no error backoff.
- **SSE stream has no reconnect**: `DashboardLayout.tsx:154` — `es.onerror = () => es.close();`. One blip kills live unread counts until a full page remount. The JWT is passed as `?token=` **in the URL query string** (line 145), which leaks into server/proxy access logs.
- **Tokens are non-httpOnly cookies set by `js-cookie`** (`src/lib/api.ts:19-41`, `sameSite: 'lax'`, `secure` only on https). Readable by any XSS payload; they're cookies *only* so `src/proxy.ts` can do optimistic redirects.
- **`src/proxy.ts`** correctly uses the Next 16 convention (Middleware → Proxy rename, confirmed in `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). It does optimistic JWT-decode routing only — appropriate per the docs ("should not be used as a full session management or authorization solution").
- **Tables are client-filtered full lists**: `usersApi.getAll()` is called with **no params** even though the backend accepts `{ page, limit, department, role, status }` (`api.ts:131`); `employees/page.tsx` then filters/searches in memory. Leave page filters statuses client-side too. The generic `DataTable` in `ui/index.tsx` already has props for `page/pageSize/total/onPageChange/sortKey/onSort` — they're just unused by most pages.
- **Component library** (`src/components/ui/index.tsx`, 1019 lines): Modal has no focus trap, no `role="dialog"`/`aria-modal`, no focus restore; Dropdown/ActionMenu/Tabs are click-only (no arrow-key/typeahead, no `role="listbox"`, no `aria-expanded`); Badge/StatusSelect rely on color alone; sortable headers don't expose `aria-sort`; icon buttons (bell, hamburger, modal close) mostly lack `aria-label`. All UI strings are hardcoded English; notification icons are raw emoji.
- **Forms**: RHF + zodResolver used consistently and competently (good schemas with `.refine` cross-field logic in `leave/page.tsx:28-45`). But schemas are defined inline per page, duplicated (e.g. reject-reason schema appears in leave/overtime/swaps variants), and **none are shared with the backend**. `avatar_url` is consumed in 6+ places (`dashboard`, `remote`, `RequestItem`) but there is **no upload UI** and no `multipart/form-data` call anywhere.
- **Exports**: only `analytics/reports` does exports, via backend-generated CSV `download_url` (good pattern — server generates, client gets a presigned link). No XLSX, no per-table export, no progress/empty handling beyond a basic state.
- **Lint debt confirmed**: `npx eslint src` → **103 problems (55 errors, 48 warnings)**. Errors are dominated by the new compiler-powered `react-hooks` v6 rules: `react-hooks/set-state-in-effect` and `react-hooks/preserve-manual-memoization` (e.g. `src/lib/auth.tsx:97`, `auth.tsx:144` where `useCallback([user, capabilities?.features])` can't be preserved by React Compiler), plus `exhaustive-deps` warnings and one `@typescript-eslint/no-empty-object-type`.
- **Tests**: exactly one — `src/components/ui/table.utils.test.ts`, a node:test unit test of a 6-line pure helper. No Vitest/Jest/Playwright config exists.
- **Fonts/images**: `next/font/google` (DM Sans/DM Mono) is correctly used in `app/layout.tsx`. `Avatar` uses a raw `<img>` (`ui/index.tsx:203`) — fine for tiny avatars but unoptimized; no `next/image` anywhere in the dashboard.
- **Bundled Next 16 docs** (`node_modules/next/dist/docs/`) confirm version-specific features: `proxy.ts` convention, `cacheComponents` + `'use cache'`, `unstable_instant` route export for validated instant navigation, stable `reactCompiler: true` config, Server Actions for forms, CSP-with-nonce via Proxy guide.

---

## 1. Data fetching & state

### Verdict: adopt TanStack Query v5 (already installed), keep pages as client components

Industry consensus for 2026: TanStack Query is the default for apps with mutations, optimistic updates, and cache invalidation; SWR is the lighter pick only for read-mostly apps; server components/RSC fetching is the right answer only when data can be fetched server-side. None of Attenda's constraints favor the alternatives:

- **vs SWR**: Attenda is mutation-heavy (approve/reject across leave, overtime, swaps, remote, late notices, admin org actions). TanStack Query's `useMutation` + `invalidateQueries` + `onMutate` optimistic rollback is exactly this shape; SWR's mutate-based story is weaker, and the 9 KB bundle delta is irrelevant next to recharts.
- **vs server components**: all requests need the user's JWT and the app's auth lives entirely client-side (token in JS-readable cookie, axios interceptor refresh). Moving fetching to RSC would require moving auth server-side first (see §9 — worth doing eventually, but it's a much bigger lift). RSC also doesn't help the dominant patterns here: 60 s polling dashboards, post-mutation refresh, SSE-driven counts. The Next 16 SPA guide explicitly endorses the "client app inside App Router" approach.
- The package is **already in package.json** — adopting it is configuration + incremental refactor, not a new dependency decision.

### What it fixes, concretely

| Current pain (verified) | TanStack Query answer |
|---|---|
| `setInterval` polling continues in hidden tabs; no dedupe (`dashboard/page.tsx:80`) | `refetchInterval: 60_000`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: true` |
| Full-list refetch after each approve/reject (`leave/page.tsx:94-120`) | `useMutation` + targeted `queryClient.invalidateQueries({ queryKey: ['leave'] })`, or optimistic `onMutate` row update with rollback |
| Duplicate fetches when two components need the same data (capabilities, departments fetched per-page) | request dedupe + shared cache by query key |
| `loading` boolean per page, no stale-while-revalidate | `isPending` vs `isFetching`, instant cached render on tab return |
| Hand-rolled `Promise.allSettled` pairs | `useQueries` / parallel `useQuery` |
| SSE count + manual `setUnreadCount` bookkeeping in `DashboardLayout` | SSE handler calls `queryClient.setQueryData(['notifications','count'], n)`; bell list is a normal query |

### Migration strategy (page-by-page priority)

**Step 0 (half a day):** Add `QueryClientProvider` in a small client `Providers` component wrapped inside `AuthProvider` in `app/layout.tsx`; add `@tanstack/react-query-devtools` (dev only). Set defaults: `staleTime: 30_000`, `retry: 1`, global `onError` → `toast.error(getApiError(err))` via `QueryCache`/`MutationCache` so per-page try/catch disappears.

**Step 1 — define a query-key factory** (`src/lib/queries.ts`): `keys.leave.list(filters)`, `keys.attendance.today()`, `keys.users.list(params)`, `keys.notifications.count()`, etc. Wrap each `xxxApi` call in a `queryOptions()` helper so the `res.data.data` unwrapping happens once.

**Step 2 — migrate in this order** (highest churn/benefit first):
1. **Dashboard** (`/dashboard`) — polling + lastUpdated + per-status counts; the poster child for `refetchInterval` + `dataUpdatedAt`.
2. **Leave** (`/leave`) — approval inbox with two mutations; first optimistic-update implementation, becomes the template for the other approval pages.
3. **Overtime, Remote, Shifts/Swaps, Attendance late-notices** — copy the leave pattern (these four are near-clones of leave's fetch/approve/reject loop).
4. **Employees** (`/employees`) — combine with server-side pagination work (§5): `useQuery({ queryKey: keys.users.list({page, search, department, role}), placeholderData: keepPreviousData })`.
5. **Notifications** (`DashboardLayout`) — bell list query + `markRead`/`markAllRead`/`delete` mutations with optimistic cache edits; SSE writes the count into the cache.
6. **Settings, Analytics, Payroll, Performance, Admin pages** — mechanical conversions, lowest urgency.

**Rules during migration:** never mix patterns within one page; delete the page's `useState`/`useEffect` fetch scaffolding in the same PR; keep `AuthProvider` as-is (capabilities could become a query later, but it's load-bearing for routing/RBAC — don't touch it in this phase).

Sources: [TanStack Query vs SWR (2026) — PkgPulse](https://www.pkgpulse.com/guides/tanstack-query-vs-swr-2026), [React Query vs SWR in 2026 — DEV](https://dev.to/whoffagents/react-query-vs-swr-in-2026-what-i-actually-use-and-why-3362), [TanStack official comparison](https://tanstack.com/query/v5/docs/framework/react/comparison), [Advanced Server Rendering — TanStack docs](https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr), [Refine 2025 comparison](https://refine.dev/blog/react-query-vs-tanstack-query-vs-swr-2025/).

---

## 2. Realtime (SSE)

### Fix the existing stream first — it currently dies on first error

`DashboardLayout.tsx:154`: `es.onerror = () => es.close()` plus token-in-query-string are the two defects.

Best practice (2026 consensus):
1. **Reconnect with capped exponential backoff + jitter.** Native `EventSource` auto-reconnects *some* failures (honoring the server `retry:` field), but `onerror` after certain HTTP statuses (401 after token expiry!) leaves it permanently closed — and this code actively closes it. Either: (a) keep native `EventSource`, and in `onerror` check `es.readyState === EventSource.CLOSED` → schedule reconnect with backoff capped at ~30 s; or (b) switch to **`@microsoft/fetch-event-source`**, which solves both problems at once: it sends real `Authorization: Bearer` **headers** (no token in URL/logs), gives full control over retry policy, respects `Last-Event-ID`, and can pause when `document.hidden`.
2. **Re-auth on reconnect.** Token rotates via the axios refresh interceptor; the SSE URL captures a stale token. Hook `onAccessTokenRefreshed` (already exists in `api.ts:62`) to tear down and re-open the stream with the fresh token.
3. **Heartbeat/liveness**: have the server send a comment ping (`: ping`) every ~25 s; client treats >60 s silence as dead and reconnects. Prevents zombie connections behind proxies.
4. **`Last-Event-ID`** on notification events so a reconnect can replay missed counts instead of waiting for the next push.
5. **One stream per tab is fine at this scale**; if org sizes grow, consider a `BroadcastChannel`/SharedWorker to share one connection across tabs.

### Extend SSE to live dashboard updates? Yes — but keep polling as fallback

- The live-attendance dashboard (60 s poll of `/attendance/today`) is one-way server→client — **SSE's exact sweet spot**; the 2026 literature consistently recommends SSE over WebSocket for dashboards (auto-reconnect, plain HTTP, CDN/proxy-friendly, no sticky sessions). The clean integration: server publishes lightweight invalidation events (`{type:'attendance_changed'}`, `{type:'leave_request_created'}`) on the **existing** notification stream; the client handler calls `queryClient.invalidateQueries(...)`. This gives near-realtime dashboards with zero new transport and TanStack Query handles the refetch.
- Keep the 60 s `refetchInterval` as belt-and-braces (SSE delivery is not guaranteed), but it can be lengthened to 5 min once events flow.
- **WebSockets: not justified.** No client→server streaming exists (check-in/approve are ordinary POSTs). WS would add connection state management, auth handshake design, sticky-session/server complexity for zero functional gain. Revisit only if true bidirectional features arrive (live chat beyond the current request/response AI widget, collaborative schedule editing).
- HTTP/2 on the backend/proxy removes the ~6-connections-per-domain SSE limit of HTTP/1.1 — verify the deployment path (the Next rewrites proxy in `next.config.ts` will hold the streaming connection; confirm it doesn't buffer SSE, or point `NEXT_PUBLIC_API_URL` straight at the API for the stream).

Sources: [WebSocket vs SSE — getstream.io](https://getstream.io/blog/websocket-sse/), [SSE in React — OneUptime 2026](https://oneuptime.com/blog/post/2026-01-15-server-sent-events-sse-react/view), [SSE vs WebSockets — OneUptime](https://oneuptime.com/blog/post/2026-01-27-sse-vs-websockets/view), [websocket.org comparison](https://websocket.org/comparisons/sse/), [SSE guide 2026 — DEV](https://dev.to/napster_rj/what-are-server-sent-events-sse-a-developers-guide-for-2026-4jb6).

---

## 3. UX/UI patterns from leading workforce dashboards

Patterns observed across Deputy, Rippling, Connecteam, Factorial, Personio and the B2B SaaS pattern literature, mapped to Attenda:

1. **Unified approval inbox / "My tasks".** Attenda scatters approvals across five pages (leave, overtime, remote, swaps, late notices); a manager must visit each. Leaders (Personio's workflow monitoring dashboard, Rippling's task inbox, Factorial's workflow center) converge on a single **"Approvals" queue**: one list of all pending items, type-badged, filterable, with approve/reject inline and keyboard shortcuts (J/K to move, A/R to act). Attenda already has the building blocks (`RequestItem`, `SectionCard` with counts); the backend has per-type pending endpoints. This is the **single highest-leverage UX change** — it turns the sidebar badge counts into a workflow.
2. **Exception-first dashboards.** Deputy/Personio surface *exceptions* (late, absent, missing punches, expiring documents) above raw tables. `dashboard/page.tsx` already computes an `alerts` array — promote it to the top with one-click resolution actions (acknowledge, message, override) instead of a passive list.
3. **Bulk actions.** None exist today (the `DataTable` has no row selection). Standard guidelines: checkbox column + header select-all (scoped "all on page" vs "all matching filter"), a floating contextual action bar showing count + actions (approve, export, assign shift/department, deactivate), undo-toast where destructive. Highest-value targets: leave/overtime approvals, employee import cleanup, shift assignment.
4. **Command palette (Cmd+K).** Now table-stakes in admin SaaS (Linear popularized; Rippling has global search across employees/actions). For Attenda: navigate to pages, jump to an employee, trigger "Request leave"/"Add employee". Libraries: `cmdk` (pairs with the existing Tailwind design language) — low effort, high perceived quality.
5. **Empty states that onboard.** The custom `EmptyState` component exists but most tables use ad-hoc "NO RECORDS FOUND" text (`leave/page.tsx:171-176`). Leaders use empty states as guided setup: "No shifts yet → Create your first template / Import schedule". Audit each page to pass an action button into `EmptyState`.
6. **Detail panes over modals for records.** Factorial/Personio open employee/request detail in a side drawer preserving list context; Attenda uses centered modals everywhere. A `Drawer` variant of `Modal` would modernize employees/attendance detail and works better with bulk-select flows.
7. **Mobile responsiveness of admin tools.** Attenda's sidebar collapses (good) but data tables only `overflow-x-auto` — on phones managers can't realistically approve. Pattern leaders render **card lists on <md breakpoints** (each row becomes a stacked card with primary fields + actions). Priority for approval surfaces, since approving from a phone is the #1 manager mobile job (Deputy/Connecteam are mobile-first for exactly this). The unified approval inbox should be designed mobile-first.
8. **Saved views / persistent filters.** Filters reset on navigation (all `useState`). Persist to URL search params (`useSearchParams`) — shareable links, back-button-friendly, and a prerequisite for server-side pagination anyway.

Sources: [SaaS UI workflow patterns gist](https://gist.github.com/mpaiva-cc/d4ef3a652872cb5a91aa529db98d62dd), [Bulk action UX guidelines — Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux), [Personio vs Factorial — SoftwareFinder](https://softwarefinder.com/resources/personio-vs-factorial), [Factorial workflow center](https://help.factorialhr.com/en_US/workflows-automations/about-the-workflow-center), [Rippling workforce management](https://www.rippling.com/workforce-management).

---

## 4. Forms & validation

### Current quality: good bones, organizational debt

- RHF + `zodResolver` is used consistently; cross-field `.refine` validation (leave time-window rule) is genuinely good; `formState.isSubmitting` drives button loading; `Controller` wraps the custom Dropdown/DatePicker correctly.
- **Debt:** every schema lives inline in its page file; `reason: z.string().min(5)` reject schemas are duplicated 3+ ways; payloads are sent as `Record<string, unknown>` to the API layer (`api.ts` mutation signatures are untyped), so the zod types die at the page boundary; server-side validation errors are only surfaced as a single toast (`getApiError`), never mapped to fields.

### Recommendations

1. **Centralize schemas** in `src/lib/schemas/` (one module per domain: `leave.ts`, `user.ts`, `overtime.ts`…), export both schema and `z.infer` type, and **type the api layer with them**: `submit: (data: LeaveRequestInput) => …`. This alone removes the `unknown` casts and the duplication.
2. **Share schemas with the API.** Options in order of preference: (a) if the backend is TypeScript — extract a `@attenda/schemas` workspace package consumed by both, single source of truth; (b) if the backend publishes OpenAPI — generate zod via `openapi-zod-client`/`orval` in CI and diff against handwritten schemas; (c) minimum bar: contract tests asserting the FE schema accepts/rejects the same fixtures the API does. zod 4 (already installed) is faster and has smaller bundles (`zod/mini` if needed).
3. **Map 422 field errors to RHF**: a small helper that takes the API's validation-error payload and calls `setError(field, {message})` — replaces toast-only failures with inline errors users can act on.
4. **Avatar upload (missing feature).** `avatar_url` is rendered in ≥6 components but no upload exists. Recommended pattern for this stack: profile settings gets an avatar `FileTrigger` → client-side validation (type whitelist, ≤2 MB) → square crop preview (e.g. `react-easy-crop`) → **presigned-URL upload** (`POST /users/me/avatar-upload-url` → direct PUT to S3 → `PUT /users/me {avatar_url}`), matching the payslip presigned-download pattern the backend already uses (`payroll/payslips/:id/download` returns `{url}`). Show optimistic preview, invalidate the `users/me` + capabilities queries on success. Avoid routing file bytes through the Next server (the rewrites proxy + axios JSON client aren't set up for it).
5. **Server Actions** (the Next 16 docs' preferred form story) are **not recommended yet** — they require auth to be available server-side; revisit after/if the BFF move (§9) happens.

---

## 5. Tables & exports

### Move list pages to server-side pagination/sorting/filtering

Verified problem: `usersApi.getAll()` is called with no params (backend supports `page/limit/department/role/status`); employees, leave, attendance, admin orgs all download full datasets and filter in memory. Fine at 30 employees; fails (payload size, TTFB, memory, search latency) at 1–5 k — which a SaaS must assume.

- **Threshold guidance** (TanStack Table docs): client-side is viable to a few thousand rows; beyond that, server-side wins decisively. For a multi-tenant product, design for server-side on: employees, attendance history, leave/overtime requests (all-time), admin orgs/users, notifications.
- **The repo is already half-ready**: `DataTable` (`ui/index.tsx:678`) accepts `page/pageSize/total/onPageChange/sortKey/sortDir/onSort`. The work is (1) backend list endpoints must accept `sort`, `order`, `q`, and return `{items, total}`; (2) pages hold filter state **in URL search params**, pass them into the TanStack Query key, with `placeholderData: keepPreviousData` to avoid flicker; (3) debounce search input (~300 ms).
- Don't adopt TanStack Table wholesale unless column pinning/resizing/virtualization become requirements — the in-house `DataTable` + Query covers current needs with less surface area. If requirements grow, TanStack Table's `manualPagination/manualSorting/manualFiltering` mode maps 1:1 onto the same server contract, so nothing is wasted.

### Export UX

Current: only Analytics→Reports, backend-generated CSV via `download_url` (the right architecture). Improvements:
1. **Export buttons on every major table** (employees, attendance, leave, payroll), exporting **the current filter set**, not the whole table — pass the same query params the list uses to the export endpoint. Label it explicitly: "Export 142 filtered rows (CSV)".
2. **XLSX option**: HR users live in Excel; backend `exceljs`-style generation behind the same presigned-URL flow. Client-side `xlsx` generation is acceptable only for small, already-loaded data — prefer server.
3. **Async generation for big exports**: POST returns a job id, notify completion via the existing SSE notification stream + bell entry ("Your attendance export is ready") with the presigned link. This reuses two systems Attenda already has (notifications + presigned URLs).
4. UX details: timezone-explicit timestamps in files (org timezone is already centralized via `setDisplayTimezone`), ISO dates, a "Generating…" button state, and remembering last-used format.

Sources: [TanStack Table pagination guide](https://tanstack.com/table/v8/docs/guide/pagination), [Server-side pagination/filter/sort with TanStack — Medium](https://medium.com/@clee080/how-to-do-server-side-pagination-column-filtering-and-sorting-with-tanstack-react-table-and-react-7400a5604ff2), [URL-state discussion — TanStack](https://github.com/TanStack/table/discussions/3945).

---

## 6. Accessibility & i18n readiness

### A11y gaps in `src/components/ui/index.tsx` (audited)

| Component | Gaps | Fix |
|---|---|---|
| `Modal`/`ConfirmDialog` | No focus trap, no `role="dialog" aria-modal="true" aria-labelledby`, focus not moved in / restored on close; Escape works (good) | Easiest: render on `<dialog>`/use a headless dialog primitive |
| `Dropdown` | Button has no `aria-expanded/aria-haspopup`; options are plain `<button>`s — no `role="listbox/option"`, no arrow-key navigation or typeahead; not form-focusable as a unit | Replace internals with React Aria `useSelect` or Radix Select; keep the visual shell |
| `ActionMenu`/`DataTableRowMenu` | No `role="menu"`, no arrow keys, outside-click only | Radix DropdownMenu |
| `Tabs` | No `role="tablist/tab"`, no arrow-key switching, no `aria-selected` | Radix Tabs or manual ARIA — small |
| Sortable headers | No `aria-sort` on `<th>`, direction shown by arrow glyph only | trivial |
| `Badge`/status colors | Color-only meaning in several places | label text already present mostly — verify contrast (many 10px bold-on-glass texts likely fail WCAG AA contrast & minimum size) |
| Icon buttons (bell, hamburger, close, approve/reject `action-btn`s) | Several missing `aria-label`; approve/reject are icon-only | add labels/tooltips |
| Notification icons | Raw emoji conveying type | `aria-hidden` + visible type text, or lucide icons |
| Toasts | react-hot-toast announces via aria-live (ok); ensure error toasts use `role="alert"` |  |

**Strategy:** don't rewrite the design system — swap the *behavioral* internals to a headless library while keeping the Tailwind classes. **Radix UI primitives** (dialog, dropdown-menu, select, tabs) are the lowest-friction fit for a Tailwind component file like this; **React Aria** is the alternative if finer control/hooks style is preferred. Add `eslint-plugin-jsx-a11y` (eslint-config-next includes a subset — enable the full recommended set) and an axe pass in Playwright (`@axe-core/playwright`) for the five core pages.

Also: the dashboard tables of glass-on-dark micro-text (`text-[10px]`, `tracking-[0.3em]` uppercase) should be sanity-checked against WCAG 1.4.3; several `--on-glass-dim` on `--glass-05` combos will fail.

### i18n

- All strings are hardcoded; dates use `toLocaleDateString('en-US', …)` and `date-fns format` without locale; `timeAgo` is hand-rolled English.
- **Recommendation: `next-intl`** — the 2026 default for App Router, ~2 KB, native Server Component support, ICU plurals, built-in locale routing compatible with Next 16's `proxy.ts` convention (it ships dedicated Next 16 support). `next-i18next` v16 also supports App Router/proxy.ts now, but next-intl is the better fit for a fresh adoption.
- Readiness sequencing (cheap now, expensive later): (1) stop hand-formatting dates — use `Intl.DateTimeFormat`/`Intl.RelativeTimeFormat` via one `lib/format.ts`; (2) when touching any page for the Query migration, hoist its strings into a `messages/en.json` namespace; (3) defer actual locale routing until a second language is demanded. Avoid string concatenation for sentences ("Approve X-day leave for Y?") — convert to ICU templates as encountered.

Sources: [next-intl App Router docs](https://next-intl.dev/docs/getting-started/app-router), [next-intl complete guide 2026 — IntlPull](https://intlpull.com/blog/next-intl-complete-guide-2026), [next-i18next App Router (Next 16) — i18nexus](https://i18nexus.com/tutorials/nextjs/next-i18next-app-router), [React Aria / eslint-plugin-react-hooks docs — react.dev](https://react.dev/reference/eslint-plugin-react-hooks).

---

## 7. Testing strategy

Current state: **one node:test unit test** (`table.utils.test.ts`) run via a bespoke `npm run test:ui` script; no test runner config; no E2E.

### Recommended stack (2026 consensus for this exact stack)
- **Vitest + React Testing Library + jsdom** for units/components (Vitest over Jest: ESM/TS native, faster, first-class in the Next docs; the existing node:test file ports trivially).
- **Playwright** for E2E (auth flows, approval flows, anything touching `proxy.ts` redirects/cookies — these *cannot* be unit-tested meaningfully).
- **MSW** (Mock Service Worker) to mock the `/api/v1` axios layer in component tests — it intercepts at network level so the axios interceptors (auth header, 401 refresh) are exercised, which is where this app's real risk lives.

### What to cover first, given zero coverage (ordered by risk × cheapness)
1. **Pure logic units (day 1):** `lib/utils.ts` (`getApiError`, status configs, timezone display), `table.utils.ts` (port existing), `navItemVisible()` RBAC filtering in `DashboardLayout` (extract it — it's a pure function guarding the whole nav), zod schemas (valid/invalid fixtures, especially the leave time-window refine), `proxy.ts` decision logic (extract route-decision into a pure function: token×role×path → allow/redirect matrix).
2. **API layer integration (week 1):** axios 401→refresh→retry interceptor with MSW (single-flight refresh, token persistence, logout-on-failure) — this code path silently underpins every page and currently has a known weakness (no concurrent-refresh mutex).
3. **Component tests:** `Modal` (escape/overlay close), `Dropdown` (select/clear), `DataTable` (loading/empty/pagination callbacks), Leave page approve/reject flow with MSW (the template for other pages).
4. **Playwright E2E (5–8 scenarios max initially):** login → dashboard; login with redirect param; platform_admin → /admin segregation (proxy logic); request leave → appears pending; manager approves → status flips + toast; logout clears cookies. Run against a seeded backend or full-MSW'd build.
5. **Per the 2026 guidance**: skip snapshot tests, skip prop-type assertions, target behaviors. ~80 targeted tests beats 200 trivial ones.

### Lint debt (103 problems: 55 errors / 48 warnings)
- The errors are mostly the new **compiler-powered `react-hooks` v6 rules**, and they matter beyond hygiene: **React Compiler skips optimizing any component with violations**, so fixing them is a prerequisite for §8's `reactCompiler: true` payoff.
- Triage: (a) `set-state-in-effect` (e.g. `auth.tsx:97`) — restructure to derive state or set during render/event, per react.dev guidance; (b) `preserve-manual-memoization` (e.g. `auth.tsx:144` — dep array `[user, capabilities?.features]` narrower than inferred `capabilities`) — usually fixed by *deleting* the manual `useCallback/useMemo` and letting the compiler do it, or aligning deps; (c) `exhaustive-deps` warnings — fix properly during the TanStack Query migration (most of these effects get deleted outright, which is the cheapest fix of all); (d) gate CI on `eslint --max-warnings 0` once clean.

Sources: [Next.js Vitest guide](https://nextjs.org/docs/app/guides/testing/vitest), [Next.js Testing 2026: Vitest + Playwright — Medium](https://medium.com/@securestartkit/next-js-testing-in-2026-vitest-playwright-0caf6dd1f829), [Full testing stack 2026 — PkgPulse](https://www.pkgpulse.com/blog/vitest-jest-playwright-complete-testing-stack-2026), [preserve-manual-memoization — react.dev](https://react.dev/reference/eslint-plugin-react-hooks/lints/preserve-manual-memoization).

---

## 8. Performance

Grounded in the bundled Next 16 docs (`node_modules/next/dist/docs/`), per AGENTS.md's warning:

1. **Enable React Compiler** — Next 16 has stable `reactCompiler: true` in `next.config.ts` (`03-api-reference/05-config/01-next-config-js/reactCompiler.md`). With 33 client pages and zero `React.memo` discipline, automatic memoization is the cheapest broad win — *after* clearing the 55 lint errors (violating components are skipped, not broken).
2. **Bundle review approach:** `next build` with `@next/bundle-analyzer`; expected findings here: **recharts** (heavy — load chart components via `next/dynamic` on analytics/dashboard so leave/employees pages don't pay for it), **lucide-react v1.16** (verify per-icon imports tree-shake; the modular `lucide-react@latest` does), `qrcode.react` (dynamic-import on the settings page only), date-fns v4 (fine, per-function). The marketing landing page (`app/page.tsx`) shares the client bundle baseline — confirm it isn't dragging dashboard deps.
3. **Per-route code-splitting is already won** by the App Router; the main risk is barrel files: `components/ui/index.tsx` exports everything from one module — fine while small, but consider `optimizePackageImports` or splitting if it grows.
4. **Instant navigation / Cache Components (Next 16-specific):** the docs push `cacheComponents` + `'use cache'` + `unstable_instant` exports for validated static shells (`02-guides/instant-navigation.md` — note the docs' own hint that Suspense alone is insufficient; routes should export `unstable_instant`). For Attenda, this applies **today** to the public pages (`/`, `/about`, `/blog`, `/privacy`) and becomes relevant for the dashboard only if/after auth moves server-side. Quick win: ensure public pages produce static shells with `unstable_instant = { prefetch: 'static' }`.
5. **Images:** `Avatar` uses raw `<img>` — acceptable for 24–96 px avatars (next/image overhead isn't justified per-avatar), but add `loading="lazy"`, fixed dimensions, and an error fallback to initials (currently a broken URL shows a broken image). Marketing pages should use `next/image` for hero assets.
6. **Fonts:** `next/font/google` with CSS variables is already best practice (self-hosted, no layout shift). One nit: the `Toaster` style hardcodes `fontFamily: 'DM Sans, sans-serif'` instead of `var(--font-sans)`.
7. **Rendering hotspots:** `DashboardLayout` re-renders the entire shell (nav filter recomputation, notif state) on every SSE count tick and on every minute-tick of `dateStr`; extracting the bell + clock into child components (or letting React Compiler handle it) prevents whole-tree re-renders 1×/minute. The dashboard's `key={pathname}` on the page wrapper forces full remounts on every navigation — intentional for the fade animation but it defeats any state preservation; consider View Transitions (`02-guides/view-transitions.md`) instead.
8. **Polling efficiency** is covered by §1 (focus-aware refetching) — this is also a battery/perf item, not just UX.

---

## 9. Client-side security

### Honest assessment of the token scheme

Current: **access + refresh JWTs in non-httpOnly cookies (`js-cookie`), `SameSite=Lax`, `Secure` only on https, readable and writable by any JS**. They're cookies (not localStorage) solely so `src/proxy.ts` can read them for optimistic redirects; all API auth actually flows via the `Authorization` header set by the axios interceptor.

- **What it gets right:** `SameSite=Lax` + header-based API auth means CSRF risk is low (the API ignores cookie auth); proxy-level optimistic routing per Next docs guidance; refresh rotation exists; expiry is checked client-side.
- **What's wrong:** any XSS (one compromised npm package, one unsafe `dangerouslySetInnerHTML` in e.g. the blog/AI-chat rendering path) exfiltrates **both tokens**, including the long-lived 30-day refresh token. This is materially worse than memory-held access + httpOnly refresh. The SSE token-in-URL (`?token=`) additionally leaks the access token into access logs/referrers. There is no CSP to blunt XSS. For an HR product holding salary and attendance data, this is the most serious finding in this report.
- **Industry direction (RFC 9700 / 2025-26 consensus):** BFF pattern — tokens never reach the browser; the browser holds only an httpOnly session cookie. Next.js is *already* positioned for this: the existing `/api/v1` rewrite proxy could become a thin Route Handler BFF that attaches the Authorization header server-side.

**Pragmatic remediation ladder (each step is independently shippable):**
1. **Now (cheap):** stop putting the token in the SSE URL (fetch-event-source with header, §2); set refresh-token cookie `SameSite=Strict`; reduce non-remembered session cookie lifetimes; single-flight mutex on the refresh interceptor (concurrent 401s currently race).
2. **Next: CSP via Proxy** (the bundled guide `02-guides/content-security-policy.md` shows the nonce-in-proxy pattern). Start `Content-Security-Policy-Report-Only` with `default-src 'self'`, explicit `connect-src` (API origin), `img-src` (avatar/S3 origins), then enforce. Add `X-Frame-Options/frame-ancestors`, `Referrer-Policy`, `Permissions-Policy` in `next.config.ts` headers.
3. **Target architecture: httpOnly cookies + BFF.** Login via a Route Handler that sets httpOnly `Secure` cookies; all `/api/v1/*` calls go through Route Handlers (or keep the rewrite + a tiny token-attaching proxy layer) so JS never sees tokens. `proxy.ts` keeps working unchanged (it reads cookies server-side — httpOnly is irrelevant there; it actually gets *more* trustworthy). This also unblocks RSC data fetching (§1) and Server Actions (§4). Estimated medium effort: auth.tsx, api.ts interceptors, SSE auth, and logout flows all change; do it as its own project.
4. **Dependency hygiene:** add `npm audit` + a lockfile-aware scanner (Dependabot/Socket/renovate) to CI; the supply-chain XSS scenario is exactly what makes finding #2 urgent. Also pin and review `recharts`/`qrcode.react` transitive trees. Verify the blog `[slug]` page and AI chat widget never render API HTML unsanitized.

Sources: [JWT best practices — Duende](https://duendesoftware.com/learn/best-practices-using-jwts-with-web-and-mobile-apps), [SPA auth with JWT and cookies — Povio](https://povio.com/blog/handling-authentication-in-spa-with-jwt-and-cookies), [Securing JWT with httpOnly cookies — Wisp](https://www.wisp.blog/blog/ultimate-guide-to-securing-jwt-authentication-with-httponly-cookies), [SPA JWT vs cookies — InfoBytes](https://infobytes.guru/articles/spa-authentication-jwt-vs-cookies.html), bundled Next docs CSP guide.

---

## Ranked implementation roadmap (impact × effort, specific to this repo)

### Tier 1 — Do immediately (days, high impact)
1. **Fix the SSE stream** (`DashboardLayout.tsx`): reconnect w/ capped backoff, token via header using `@microsoft/fetch-event-source`, re-subscribe on token refresh, heartbeat timeout. *Fixes a live bug (dead notifications after one error) and the token-in-logs leak.* (~1 day)
2. **Stand up TanStack Query** (provider, defaults, query-key factory) and **migrate Dashboard + Leave** as the templates — including optimistic approve/reject. (~2–3 days)
3. **Refresh-interceptor mutex + cookie hardening** (single-flight refresh, SameSite=Strict on refresh token). (~½ day)
4. **Burn down the 55 react-hooks/compiler lint errors**, then gate CI on lint. Many die naturally with item 2. (~2 days alongside)
5. **Vitest bootstrap + first unit tests** (utils, schemas, `navItemVisible`, proxy decision logic; port the node:test file). (~1 day)

### Tier 2 — Next 2–6 weeks (high impact, moderate effort)
6. **Finish Query migration** across overtime/remote/swaps/attendance/employees/notifications; delete per-page fetch scaffolding; route filter state into URL params.
7. **Server-side pagination/sort/search** on employees, attendance, leave, admin orgs (DataTable props already exist; needs small backend contract: `sort`, `q`, `{items,total}`).
8. **Unified Approvals inbox** (one page aggregating all pending request types, keyboard-driven, mobile-card layout) — the flagship UX improvement; reuses `RequestItem` + the new mutation hooks.
9. **A11y retrofit of `ui/index.tsx`**: Radix internals for Modal/Dropdown/ActionMenu/Tabs, `aria-label` sweep on icon buttons, `aria-sort`, contrast audit. Enable full `jsx-a11y` ruleset.
10. **CSP in Report-Only via `proxy.ts`** + security headers; dependency audit in CI.
11. **Playwright E2E** for the 6 money paths (login, redirect, admin segregation, request→approve leave, logout); MSW for component-level approval-flow tests.
12. **Enable `reactCompiler: true`** once lint errors are cleared; split `DashboardLayout` bell/clock into child components; dynamic-import recharts + qrcode.

### Tier 3 — Quarter horizon (high impact, higher effort)
13. **Avatar upload** (presigned-URL flow + crop UI) and shared zod schema strategy with the API (workspace package or OpenAPI-generated).
14. **Bulk actions** (row selection in DataTable, floating action bar, bulk approve/export) + per-table filtered CSV/XLSX export with async generation notified over SSE.
15. **SSE-driven dashboard invalidation events** (server emits `attendance_changed` etc.; client invalidates queries; relax polling to 5 min).
16. **Command palette (`cmdk`)** + saved views; empty-state onboarding pass; drawer-based detail views; mobile card layouts for remaining tables.
17. **i18n groundwork**: centralize date/number formatting on `Intl`, extract strings to `next-intl` messages opportunistically; full locale routing only when a second language is committed.

### Tier 4 — Strategic (large effort, do as a dedicated project)
18. **BFF auth migration** (httpOnly cookies, Route-Handler token proxy) — the definitive fix for token exposure; unblocks RSC data fetching, Server Actions, and Cache-Components/`unstable_instant` for authenticated routes.
19. **Selective RSC adoption post-BFF** (first-paint data for dashboard shell, static shells + `unstable_instant` for public pages now).
20. Remove `@tanstack/react-query` from package.json **only if** a deliberate decision is made not to adopt it (otherwise it's the Tier-1 plan).

**Dependency note:** 2→6→7/8 form one track (data layer); 1→15 (realtime); 4→12 (compiler); 10→18 (security); 9→16/17 (UI platform). Tier 1 items have no interdependencies and can start in parallel.
