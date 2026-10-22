import test from 'node:test';
import assert from 'node:assert/strict';
import { localDateKey } from '../src/services/date.js';

test('uses the local calendar day rather than the UTC date', () => {
  assert.equal(localDateKey('2026-10-14T22:30:00.000Z'), '2026-10-15');
});
