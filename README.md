# Attenda Web Dashboard

Next.js 16 frontend for the Attenda Workforce Management Platform.

## Features

- **Authentication** — Login (+ TOTP 2FA, Google SSO), forgot/reset password, JWT with auto-refresh, route guards
- **Layout** — Sidebar navigation (role- and permission-scoped), notification bell with SSE live unread count, mobile responsive
- **Dashboard** — Live attendance grid, KPI cards, alerts panel (auto-refreshes every 60s)
- **Employees** — List, add, edit, deactivate, CSV import, per-user permission grants
- **Attendance** — Check-in/out, breaks, late notices, manager override (audited), CSV export
- **Leave** — Request, approve, reject, balances
- **Shifts** — Templates with break policies, weekly assignment board, publishing, AI scheduling, swap approvals
- **Payroll** — Generate, adjust, process with payslip PDFs
- **Overtime / Remote / Performance / Analytics** — Requests & approvals, remote-session monitoring, reviews & goals, charts and CSV reports
- **Admin console** — Platform org/plan/user/blog management (platform_admin role)

## Tech Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS (custom Attenda design tokens)
- DM Sans + DM Mono fonts
- Axios + JWT interceptors for real API calls
- React Hook Form + Zod validation
- React Hot Toast for notifications
- date-fns for date formatting

## Getting Started

```bash
cp .env.example .env.local
# Edit NEXT_PUBLIC_API_URL to point to your backend
npm install
npm run dev
```

## API Connection

All API calls go to `NEXT_PUBLIC_API_URL` (default: the `/api/v1` rewrite in
`next.config.ts`, which proxies to `BACKEND_API_URL`). The client
(`src/lib/api.ts`):
- Attaches the JWT from cookies on every request
- Auto-refreshes expired tokens using the refresh token
- Redirects to /login on 401 if refresh fails

### Contract rules (read before touching `src/lib/api.ts`)

The **backend (attenda-api) route definitions are the source of truth** for
every path, HTTP verb, and payload. When adding or changing a call:

1. Find the route in `attenda-api/src/routes/*.ts` and match its method,
   path, and body fields exactly — do not guess.
2. All success responses are wrapped in `{ success: true, data: ... }` —
   always read `res.data.data`.
3. Approve/reject style reviews are `PUT`, not `POST`.
4. Remote-work session endpoints live under `/attendance/remote/*`.
5. Reports are generated via `POST /reports/:type` and return a
   `download_url` (presigned S3 URL, or a `data:` URI when S3 is not
   configured) — there is no separate download endpoint.
6. Payslip downloads (`GET /payroll/payslips/:id/download`) return JSON
   `{ url }`, not a blob.
7. Employee import (`POST /users/import`) takes parsed JSON
   `{ users: [{ name, email, role?, department?, phone? }] }` — parse the
   CSV in the browser first.
