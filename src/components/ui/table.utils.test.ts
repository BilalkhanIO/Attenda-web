import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowTableEmptyState } from './table.utils.ts';

test('shouldShowTableEmptyState hides empty while loading', () => {
  assert.equal(shouldShowTableEmptyState(true, 0), false);
});

test('shouldShowTableEmptyState shows empty when no rows', () => {
  assert.equal(shouldShowTableEmptyState(false, 0), true);
});

test('shouldShowTableEmptyState hides empty when rows exist', () => {
  assert.equal(shouldShowTableEmptyState(false, 3), false);
});
