import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceDateKey } from '../src/utils/deviceDate.js';

test('filters a punch by its Riyadh calendar day', () => {
  assert.equal(deviceDateKey('2026-10-14T22:30:00.000Z', 'Asia/Riyadh'), '2026-10-15');
});
