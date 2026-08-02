import { parseISO } from 'date-fns';

// ─── Locale / timezone / currency configuration ────────────────────
// Single source of truth for every date/time/number/currency render in
// the app. A future locale switch (roadmap #33) is `setLocale('de-DE')`
// — every helper below re-renders through Intl with the active locale.

let _locale = 'en-US';

export function setLocale(locale: string) {
  if (locale) _locale = locale;
}
export function getLocale() {
  return _locale;
}

// All wall-clock display uses the ORGANISATION's timezone, so an
// employee's 9:00 AM check-in reads as 9:00 AM for every viewer
// regardless of their own browser timezone. Set once after login
// (AuthProvider → setDisplayTimezone) from the org settings; until then
// we fall back to the browser timezone so the first paint isn't UTC.
let _displayTz: string = (typeof Intl !== 'undefined'
  && Intl.DateTimeFormat().resolvedOptions().timeZone) || 'UTC';

export function setDisplayTimezone(tz?: string | null) {
  if (tz) _displayTz = tz;
}
export function getDisplayTimezone() {
  return _displayTz;
}

/**
 * Sentinel accepted anywhere a `timeZone` is: format in the VIEWER's
 * browser timezone instead of the org display timezone (e.g. the
 * "today" header in layouts, or a local calendar-picker date).
 */
export const LOCAL_TZ = 'local';

// Org currency for money display. Defaults to USD; call
// setDefaultCurrency once org settings expose a currency code.
let _currency = 'USD';

export function setDefaultCurrency(currency?: string | null) {
  if (currency) _currency = currency;
}
export function getDefaultCurrency() {
  return _currency;
}

// ─── Internals ──────────────────────────────────────────────────────
export type DateFormatOptions = Intl.DateTimeFormatOptions & {
  /** Per-call locale override (rare — style-pinned renders only). */
  locale?: string;
};
export type NumberFormatOptions = Intl.NumberFormatOptions & {
  /** Per-call locale override (rare — style-pinned renders only). */
  locale?: string;
};

function toInstant(date: string | Date): Date {
  return typeof date === 'string' ? parseISO(date) : date;
}

// Intl formatter construction is expensive — cache per locale+options.
const dtfCache = new Map<string, Intl.DateTimeFormat>();
const nfCache = new Map<string, Intl.NumberFormat>();
const rtfCache = new Map<string, Intl.RelativeTimeFormat>();

function dateTimeFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = dtfCache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(locale, options);
    dtfCache.set(key, fmt);
  }
  return fmt;
}

function numberFormatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}|${JSON.stringify(options)}`;
  let fmt = nfCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, options);
    nfCache.set(key, fmt);
  }
  return fmt;
}

function relativeTimeFormatter(locale: string, style: Intl.RelativeTimeFormatStyle): Intl.RelativeTimeFormat {
  const key = `${locale}|${style}`;
  let fmt = rtfCache.get(key);
  if (!fmt) {
    fmt = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style });
    rtfCache.set(key, fmt);
  }
  return fmt;
}

/** timeZone resolution: default → org display tz, LOCAL_TZ → browser. */
function resolveTimeZone(timeZone?: string): string | undefined {
  if (timeZone === LOCAL_TZ) return undefined;
  return timeZone ?? _displayTz;
}

// ─── Date / time ────────────────────────────────────────────────────
/** Default date render — "Aug 2, 2026" under en-US. */
export const DATE_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
/** Default time render — "09:04 AM" under en-US. */
export const TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };

/**
 * Format an instant (Date or ISO string) in the org display timezone.
 * Pass Intl.DateTimeFormatOptions to control the fields shown; with no
 * field options it renders DATE_FORMAT. `timeZone: LOCAL_TZ` formats in
 * the viewer's browser timezone instead.
 */
export function formatDate(date: string | Date, options: DateFormatOptions = {}): string {
  const { locale = _locale, timeZone, ...fields } = options;
  const components = Object.keys(fields).length > 0 ? fields : DATE_FORMAT;
  return dateTimeFormatter(locale, { ...components, timeZone: resolveTimeZone(timeZone) }).format(toInstant(date));
}

/** Format the time-of-day of an instant ("09:04 AM"). */
export function formatTime(date: string | Date, options: DateFormatOptions = {}): string {
  const { locale = _locale, timeZone, ...fields } = options;
  const components = Object.keys(fields).length > 0 ? fields : TIME_FORMAT;
  return dateTimeFormatter(locale, { ...components, timeZone: resolveTimeZone(timeZone) }).format(toInstant(date));
}

/** Date + time ("Aug 2, 2026 09:04 AM"). */
export function formatDateTime(date: string | Date, options: Pick<DateFormatOptions, 'locale' | 'timeZone'> = {}): string {
  return `${formatDate(date, options)} ${formatTime(date, options)}`;
}

/**
 * Format a calendar-date-only value (a @db.Date field such as
 * attendance.date, stored as UTC-midnight carrying the org-local
 * Y-M-D). Rendered in UTC so the day never shifts in timezones behind
 * UTC.
 */
export function formatDateOnly(date: string | Date, options: Omit<DateFormatOptions, 'timeZone'> = {}): string {
  return formatDate(date, { ...options, timeZone: 'UTC' });
}

/**
 * Machine format: the Y-M-D of an instant in the org display timezone
 * as "yyyy-MM-dd" (API params, <input type="date"> values). Not
 * locale-dependent — the field ORDER is fixed; only the timezone
 * projection applies.
 */
export function toISODate(date: string | Date, timeZone?: string): string {
  const parts = dateTimeFormatter('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: resolveTimeZone(timeZone),
  }).formatToParts(toInstant(date));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// ─── Relative time ──────────────────────────────────────────────────
// Cascade thresholds (seconds → unit) for Intl.RelativeTimeFormat.
const RELATIVE_DIVISIONS: Array<{ limit: number; divisor: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { limit: 60,         divisor: 1,          unit: 'second' },
  { limit: 3_600,      divisor: 60,         unit: 'minute' },
  { limit: 86_400,     divisor: 3_600,      unit: 'hour'   },
  { limit: 604_800,    divisor: 86_400,     unit: 'day'    },
  { limit: 2_629_800,  divisor: 604_800,    unit: 'week'   },
  { limit: 31_557_600, divisor: 2_629_800,  unit: 'month'  },
  { limit: Infinity,   divisor: 31_557_600, unit: 'year'   },
];

/**
 * Relative duration between an instant and now — "3 hours ago",
 * "yesterday", "in 2 months". Timezone-agnostic. `style: 'narrow'`
 * gives the compact "3h ago" form used in notification lists.
 */
export function formatRelative(
  date: string | Date,
  options: { locale?: string; style?: Intl.RelativeTimeFormatStyle; now?: Date } = {},
): string {
  const { locale = _locale, style = 'long', now = new Date() } = options;
  const diffSeconds = (toInstant(date).getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diffSeconds);
  const division = RELATIVE_DIVISIONS.find(d => abs < d.limit) ?? RELATIVE_DIVISIONS[RELATIVE_DIVISIONS.length - 1];
  const value = Math.trunc(diffSeconds / division.divisor);
  return relativeTimeFormatter(locale, style).format(value, division.unit);
}

// ─── Numbers / currency ─────────────────────────────────────────────
/** Locale-aware number ("1,234.5" under en-US). */
export function formatNumber(value: number, options: NumberFormatOptions = {}): string {
  const { locale = _locale, ...rest } = options;
  return numberFormatter(locale, rest).format(value);
}

/**
 * Money in the given ISO-4217 currency (defaults to the org currency —
 * see setDefaultCurrency). "$1,234.50" under en-US/USD.
 */
export function formatCurrency(amount: number, currency: string = _currency, options: NumberFormatOptions = {}): string {
  return formatNumber(amount, { style: 'currency', currency, ...options });
}
