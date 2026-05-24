# Attenda Web Dashboard

Next.js 16 frontend for the Attenda Workforce Management Platform.

## Phase 1 — Completed

- **Authentication** — Login, forgot password, JWT with auto-refresh, route guards
- **Layout** — Sidebar navigation (role-scoped), top header, mobile responsive
- **Dashboard** — Live attendance grid, KPI cards, alerts panel (auto-refreshes every 60s)
- **Employees** — List, add, edit, view profile, deactivate — all via modals
- **Attendance** — Daily records table with override modal (audited)
- **Leave** — Request, approve, reject — all via modals with form validation

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

All API calls go to `NEXT_PUBLIC_API_URL`. The client:
- Attaches JWT from cookies on every request
- Auto-refreshes expired tokens using the refresh token
- Redirects to /login on 401 if refresh fails

## Phase 2 (Next)
- Shift Scheduling (weekly calendar, drag-assign)
- Payroll (review, adjust, process, payslips)
- Performance Tracking
- Analytics & Reports (Recharts)
- WhatsApp & Settings configuration
