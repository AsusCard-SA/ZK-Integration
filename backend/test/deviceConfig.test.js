import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeviceConfig } from '../src/config/deviceConfig.js';

test('keeps the existing device defaults', () => {
  assert.deepEqual(getDeviceConfig({}), {
    model: 'MB2000',
    ip: '192.168.1.147',
    port: 4370,
    timezone: null
  });
});

test('uses an isolated Saudi device profile supplied by the launcher', () => {
  assert.deepEqual(getDeviceConfig({
    ZK_MODEL: 'F22',
    ZK_IP: '192.168.100.201',
    ZK_PORT: '80',
    ZK_TIMEZONE: 'Asia/Riyadh'
  }), {
    model: 'F22',
    ip: '192.168.100.201',
    port: 80,
    timezone: 'Asia/Riyadh'
  });
});
