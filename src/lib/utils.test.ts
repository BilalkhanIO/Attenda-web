import { describe, it, expect } from 'vitest';
import { getApiError } from './utils';

describe('getApiError', () => {
  it('prefers the API envelope error field', () => {
    expect(getApiError({ response: { data: { error: 'Insufficient balance' } } }))
      .toBe('Insufficient balance');
  });
  it('falls back to message field, then generic', () => {
    expect(getApiError({ response: { data: { message: 'Nope' } } })).toBe('Nope');
    expect(getApiError({ response: { data: {} } })).toBe('Something went wrong');
  });
  it('handles plain Errors and unknowns', () => {
    expect(getApiError(new Error('boom'))).toBe('boom');
    expect(getApiError(undefined)).toBe('Something went wrong');
  });
});
