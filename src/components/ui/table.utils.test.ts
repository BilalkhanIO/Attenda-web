import { test, expect } from 'vitest';
import { shouldShowTableEmptyState } from './table.utils';

test('shouldShowTableEmptyState hides empty while loading', () => {
  expect(shouldShowTableEmptyState(true, 0)).toBe(false);
});

test('shouldShowTableEmptyState shows empty when no rows', () => {
  expect(shouldShowTableEmptyState(false, 0)).toBe(true);
});

test('shouldShowTableEmptyState hides empty when rows exist', () => {
  expect(shouldShowTableEmptyState(false, 3)).toBe(false);
});
