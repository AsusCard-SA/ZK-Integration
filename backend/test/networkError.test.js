import test from 'node:test';
import assert from 'node:assert/strict';
import { networkErrorMessage } from '../src/utils/networkError.js';

test('shows the underlying network code without exposing request details', () => {
  const error = new TypeError('fetch failed', { cause: Object.assign(new Error('private details'), { code: 'ENOTFOUND' }) });
  assert.equal(networkErrorMessage(error, 'Connection timed out (10s)'), 'fetch failed (ENOTFOUND)');
});

test('retains the timeout message', () => {
  assert.equal(networkErrorMessage({ name: 'AbortError' }, 'Connection timed out (10s)'), 'Connection timed out (10s)');
});
