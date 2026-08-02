import { describe, it, expect, beforeEach } from 'vitest';
import {
  setLocale, getLocale,
  setDisplayTimezone, getDisplayTimezone,
  setDefaultCurrency, getDefaultCurrency,
  formatDate, formatTime, formatDateTime, formatDateOnly,
  toISODate, formatRelative, formatNumber, formatCurrency,
  LOCAL_TZ,
} from './i18n';
import {
  formatDate as utilsFormatDate,
  formatTime as utilsFormatTime,
  formatDateTime as utilsFormatDateTime,
  formatDateOnly as utilsFormatDateOnly,
  formatCurrency as utilsFormatCurrency,
} from './utils';

// ICU may join tokens with NBSP / narrow NBSP — normalize for stable assertions.
const norm = (s: string) => s.replace(/[  ]/g, ' ');

// 17:30 UTC → 22:30 in Karachi (UTC+5), 12:30 in New York (UTC-5, winter).
const INSTANT = '2026-03-01T17:30:00.000Z';
// 02:00 UTC → previous day in timezones behind UTC.
const EARLY_INSTANT = '2026-03-01T02:00:00.000Z';
const NOW = new Date('2026-03-01T12:00:00.000Z');

beforeEach(() => {
  setLocale('en-US');
  setDisplayTimezone('Asia/Karachi');
  setDefaultCurrency('USD');
});

describe('locale / timezone / currency state', () => {
  it('exposes the configured values', () => {
    expect(getLocale()).toBe('en-US');
    expect(getDisplayTimezone()).toBe('Asia/Karachi');
    expect(getDefaultCurrency()).toBe('USD');
  });

  it('ignores empty overrides', () => {
    setLocale('');
    setDisplayTimezone(null);
    setDefaultCurrency(undefined);
    expect(getLocale()).toBe('en-US');
    expect(getDisplayTimezone()).toBe('Asia/Karachi');
    expect(getDefaultCurrency()).toBe('USD');
  });
});

describe('formatDate / formatTime / formatDateTime', () => {
  it('renders in the org display timezone by default', () => {
    expect(formatDate(INSTANT)).toBe('Mar 1, 2026');
    expect(norm(formatTime(INSTANT))).toBe('10:30 PM');
    expect(norm(formatDateTime(INSTANT))).toBe('Mar 1, 2026 10:30 PM');
  });

  it('respects a per-call timeZone (day shifts behind UTC)', () => {
    expect(formatDate(EARLY_INSTANT, { timeZone: 'America/New_York' })).toBe('Feb 28, 2026');
    expect(norm(formatTime(INSTANT, { timeZone: 'America/New_York' }))).toBe('12:30 PM');
  });

  it('respects the display timezone set at runtime', () => {
    setDisplayTimezone('America/New_York');
    expect(formatDate(EARLY_INSTANT)).toBe('Feb 28, 2026');
  });

  it('accepts Intl field options and per-call locale overrides', () => {
    expect(formatDate(INSTANT, { weekday: 'short', month: 'short', day: 'numeric' })).toBe('Sun, Mar 1');
    // Style-pinned day-first render used by admin/marketing pages.
    expect(formatDate(INSTANT, { day: 'numeric', month: 'short', year: 'numeric', locale: 'en-GB' })).toBe('1 Mar 2026');
  });

  it('is parametrized by the module locale (de-DE)', () => {
    setLocale('de-DE');
    expect(formatDate(INSTANT)).toBe('1. März 2026');
    expect(norm(formatTime(INSTANT))).toBe('22:30');
  });

  it('accepts Date instances as well as ISO strings', () => {
    expect(formatDate(new Date(INSTANT))).toBe('Mar 1, 2026');
  });
});

describe('formatDateOnly', () => {
  it('renders @db.Date values in UTC so the day never shifts', () => {
    setDisplayTimezone('America/New_York'); // would shift midnight UTC back a day
    expect(formatDateOnly('2026-03-01T00:00:00.000Z')).toBe('Mar 1, 2026');
  });
});

describe('toISODate', () => {
  it('projects an instant to yyyy-MM-dd in the display timezone', () => {
    expect(toISODate(EARLY_INSTANT)).toBe('2026-03-01'); // Karachi, UTC+5
    expect(toISODate(EARLY_INSTANT, 'America/New_York')).toBe('2026-02-28');
  });

  it('is locale-independent', () => {
    setLocale('de-DE');
    expect(toISODate(INSTANT)).toBe('2026-03-01');
  });
});

describe('formatRelative', () => {
  it('formats past and future instants', () => {
    expect(formatRelative('2026-03-01T09:00:00.000Z', { now: NOW })).toBe('3 hours ago');
    expect(formatRelative('2026-03-01T11:30:00.000Z', { now: NOW })).toBe('30 minutes ago');
    expect(formatRelative('2026-03-03T12:00:00.000Z', { now: NOW })).toBe('in 2 days');
    expect(formatRelative('2026-05-15T12:00:00.000Z', { now: NOW })).toBe('in 2 months');
  });

  it('supports the narrow style used by notification lists', () => {
    expect(formatRelative('2026-03-01T11:55:00.000Z', { now: NOW, style: 'narrow' })).toBe('5m ago');
    expect(formatRelative('2026-03-01T09:00:00.000Z', { now: NOW, style: 'narrow' })).toBe('3h ago');
  });

  it('is parametrized by the module locale (de-DE)', () => {
    setLocale('de-DE');
    expect(formatRelative('2026-03-01T09:00:00.000Z', { now: NOW })).toBe('vor 3 Stunden');
  });
});

describe('formatNumber / formatCurrency', () => {
  it('formats numbers with the active locale', () => {
    expect(formatNumber(1234.56)).toBe('1,234.56');
    expect(formatNumber(5.5, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('5.5');
    setLocale('de-DE');
    expect(formatNumber(1234.56)).toBe('1.234,56');
  });

  it('formats currency with the org default and explicit codes', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
    expect(norm(formatCurrency(25, 'USD', { currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }))).toBe('USD 25.00');
    setDefaultCurrency('EUR');
    setLocale('de-DE');
    expect(norm(formatCurrency(1234.5))).toBe('1.234,50 €');
  });
});

describe('utils.ts wrappers keep their legacy signatures', () => {
  it('formatDate honours the default and yyyy-MM-dd patterns with a tz argument', () => {
    expect(utilsFormatDate(INSTANT)).toBe('Mar 1, 2026');
    expect(utilsFormatDate(EARLY_INSTANT, 'yyyy-MM-dd')).toBe('2026-03-01');
    expect(utilsFormatDate(EARLY_INSTANT, 'yyyy-MM-dd', 'America/New_York')).toBe('2026-02-28');
    expect(utilsFormatDate(EARLY_INSTANT, 'MMM d, yyyy', 'America/New_York')).toBe('Feb 28, 2026');
  });

  it('formatTime / formatDateTime / formatDateOnly match the i18n output', () => {
    expect(norm(utilsFormatTime(INSTANT))).toBe('10:30 PM');
    expect(norm(utilsFormatDateTime(INSTANT))).toBe('Mar 1, 2026 10:30 PM');
    setDisplayTimezone('America/New_York');
    expect(utilsFormatDateOnly('2026-03-01T00:00:00.000Z')).toBe('Mar 1, 2026');
  });

  it('formatCurrency falls back to the org default currency', () => {
    expect(utilsFormatCurrency(9.99)).toBe('$9.99');
    expect(utilsFormatCurrency(9.99, 'GBP')).toBe('£9.99');
  });
});

describe('LOCAL_TZ sentinel', () => {
  it('formats in the runtime local timezone (matches toLocaleDateString)', () => {
    const d = new Date(2026, 2, 1); // local midnight, 1 March 2026
    expect(formatDate(d, { month: 'long', timeZone: LOCAL_TZ })).toBe(
      d.toLocaleDateString('en-US', { month: 'long' }),
    );
  });
});
