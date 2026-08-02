/** Shared display metadata for the employee document vault. */
import { formatNumber } from '@/lib/i18n';

export const DOCUMENT_CATEGORY_META: Record<string, { label: string; color: string }> = {
  contract:    { label: 'Contract',    color: '#38bdf8' },
  id:          { label: 'ID',          color: '#a78bfa' },
  visa:        { label: 'Visa',        color: '#f59e0b' },
  certificate: { label: 'Certificate', color: '#10b981' },
  other:       { label: 'Other',       color: '#94a3b8' },
};

export const DOCUMENT_CATEGORY_OPTIONS = Object.entries(DOCUMENT_CATEGORY_META)
  .map(([value, meta]) => ({ value, label: meta.label }));

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const oneDecimal = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
  if (bytes < 1024) return `${formatNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, oneDecimal)} KB`;
  return `${formatNumber(bytes / (1024 * 1024), oneDecimal)} MB`;
}

/** Days until the given YYYY-MM-DD / ISO date; negative when past. */
export function daysUntil(date: string): number {
  const target = new Date(date).getTime();
  return Math.ceil((target - Date.now()) / 86_400_000);
}
