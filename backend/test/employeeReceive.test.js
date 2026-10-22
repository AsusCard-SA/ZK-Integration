import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dataDir = mkdtempSync(join(tmpdir(), 'zk-employees-'));
process.env.EDARA_DATA_DIR = dataDir;
const { default: service } = await import('../src/services/employeeReceiveService.js');

const file = name => join(dataDir, name);
const byCode = code => service.getEmployees().find(e => e.employeeCode === code);
const central = (overrides = {}) => ({
  central_uid: 'c-100',
  employee_code: 'HR-2024-000123',
  full_name: 'Sara Ahmed',
  company_id: 3,
  branch_id: null,
  active: true,
  ...overrides
});

test.after(() => rmSync(dataDir, { recursive: true, force: true }));

test('records stored in the first format are migrated and backed up before rewrite', () => {
  const v1 = [{
    employeeId: '900', name: 'Legacy User', company: 'Asus Cards', branch: 'Riyadh',
    status: 'synced', deviceUid: 12, lastError: '', receivedAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z', approvedAt: null, syncedAt: '2026-10-01T00:00:00.000Z'
  }];
  writeFileSync(file('receivedEmployees.json'), JSON.stringify(v1));

  const legacy = service.getEmployees()[0];
  assert.equal(legacy.id, 'legacy_900');
  assert.equal(legacy.employeeCode, '900');
  assert.equal(legacy.deviceUserId, '900');
  assert.equal(legacy.active, true);
  assert.equal(legacy.status, 'synced');
  assert.equal(legacy.deviceUid, 12);

  service.receive({ employeeId: '901', name: 'Trigger save' });
  assert.deepEqual(JSON.parse(readFileSync(file('receivedEmployees.v1.backup.json'), 'utf8')), v1);
  assert.equal(JSON.parse(readFileSync(file('receivedEmployees.json'), 'utf8'))[0].id, 'legacy_900');
});

test('token is stored only as a hash and verified exactly', () => {
  assert.equal(service.verifyToken('anything'), false);
  const token = service.generateToken();
  assert.equal(service.verifyToken(token), true);
  assert.equal(service.verifyToken(`${token}x`), false);
  assert.ok(!readFileSync(file('employeeApiSettings.json'), 'utf8').includes(token));
  assert.equal(service.getPublicSettings().tokenHash, undefined);
});

test('regenerating the token revokes the old one', () => {
  const first = service.generateToken();
  const second = service.generateToken();
  assert.equal(service.verifyToken(first), false);
  assert.equal(service.verifyToken(second), true);
});

test('API starts disabled and can be toggled once a token exists', () => {
  assert.equal(service.getSettings().enabled, false);
  assert.equal(service.setEnabled(true).enabled, true);
  assert.equal(service.setEnabled(false).enabled, false);
});

test('original payloads keep working: duplicates are reported, never updated', () => {
  const first = service.receive({ employees: [
    { employeeId: '1001', name: 'Sara', company: 'Asus Cards', branch: 'Riyadh' },
    { employee_id: 1002, employee_name: 'Omar' },
    { employeeId: '1001', name: 'Sara again' },
    { name: 'No id' }
  ] });
  assert.deepEqual(first.created, ['1001', '1002']);
  assert.deepEqual(first.duplicates, ['1001']);
  assert.equal(first.invalid.length, 1);

  const again = service.receive({ employeeId: '1001', name: 'Changed' });
  assert.deepEqual(again.duplicates, ['1001']);
  assert.equal(byCode('1001').name, 'Sara');
  assert.equal(byCode('1001').deviceUserId, '1001');
  assert.equal(byCode('1001').employeeId, '1001');
});

test('ZK Central payload: full_name, ids preserved, long HR code kept apart from device ID', () => {
  const res = service.receive({ source: 'zk-central', request_id: 'req-1', employees: [central()] });
  assert.equal(res.request_id, 'req-1');
  assert.deepEqual(res.created, ['HR-2024-000123']);
  assert.equal(res.warnings.length, 1);

  const rec = byCode('HR-2024-000123');
  assert.equal(rec.centralUid, 'c-100');
  assert.equal(rec.name, 'Sara Ahmed');
  assert.equal(rec.companyId, 3);
  assert.equal(rec.branchId, null);
  assert.equal(rec.active, true);
  assert.equal(rec.deviceUserId, null);
  assert.equal(rec.source, 'zk-central');
  assert.equal(rec.lastRequestId, 'req-1');
  // Cannot be approved until it has a device ID
  assert.equal(service.approve([rec.id]).length, 0);
});

test('explicit device_user_id is used and validated', () => {
  const ok = service.receive(central({ central_uid: 'c-200', employee_code: 'HR-LONG-CODE-0200', device_user_id: '2200' }));
  assert.equal(ok.created.length, 1);
  assert.equal(byCode('HR-LONG-CODE-0200').deviceUserId, '2200');

  const bad = service.receive(central({ central_uid: 'c-201', employee_code: 'HR-1', device_user_id: '12345-678' }));
  assert.match(bad.invalid[0].error, /device_user_id/);

  // A device ID already used by another employee is not reused
  const clash = service.receive(central({ central_uid: 'c-202', employee_code: 'HR-0202', device_user_id: '2200' }));
  assert.equal(clash.created.length, 1);
  assert.equal(byCode('HR-0202').deviceUserId, null);
});

test('resending by central_uid updates only the fields sent and is otherwise idempotent', () => {
  const same = service.receive(central());
  assert.deepEqual(same.updated, []);
  assert.equal(same.results[0].action, 'unchanged');

  const res = service.receive({ central_uid: 'c-100', full_name: 'Sara A. Ahmed', branch_id: 'BR-7' });
  assert.equal(res.results[0].action, 'updated');
  const rec = byCode('HR-2024-000123');
  assert.equal(rec.name, 'Sara A. Ahmed');
  assert.equal(rec.branchId, 'BR-7');
  assert.equal(rec.companyId, 3, 'fields not sent are kept');
  assert.equal(service.getEmployees().filter(e => e.centralUid === 'c-100').length, 1);
});

test('central_uid conflicts are rejected', () => {
  const res = service.receive(central({ central_uid: 'c-999' }));
  assert.match(res.invalid[0].error, /another central_uid/);
  assert.equal(byCode('HR-2024-000123').centralUid, 'c-100');
});

test('existing record without central_uid is linked instead of duplicated', () => {
  const res = service.receive(central({ central_uid: 'c-1002', employee_code: '1002', full_name: 'Omar' }));
  assert.equal(res.results[0].action, 'linked');
  assert.equal(byCode('1002').centralUid, 'c-1002');
  assert.equal(service.getEmployees().filter(e => e.employeeCode === '1002').length, 1);
});

test('manual device ID assignment, approval and inactive employees', () => {
  const rec = byCode('HR-2024-000123');
  assert.throws(() => service.setDeviceUserId(rec.id, 'TOO-LONG-123'));
  assert.throws(() => service.setDeviceUserId(rec.id, '2200'), /already used/);
  assert.equal(service.setDeviceUserId(rec.id, '3001').deviceUserId, '3001');
  assert.equal(service.approve([rec.id]).length, 1);

  // A change to approved details requires approval again
  const res = service.receive({ central_uid: 'c-100', active: false });
  assert.ok(res.warnings.some(w => /approve again/.test(w.message)));
  const inactive = byCode('HR-2024-000123');
  assert.equal(inactive.active, false);
  assert.equal(inactive.status, 'pending');
  assert.equal(service.approve([inactive.id]).length, 0, 'inactive employees cannot be approved');

  service.receive({ central_uid: 'c-100', active: 'true' });
  assert.equal(service.approve(['c-100']).length, 1, 'central_uid works as a reference');

  assert.match(service.receive({ central_uid: 'c-100', active: 'maybe' }).invalid[0].error, /active/);
});

test('device results are recorded by record id and lock the device ID', () => {
  service.approve(['1001', '1002']);
  const approved = service.getApproved();
  assert.deepEqual(approved.map(e => e.deviceUserId).sort(), ['1001', '1002', '3001']);

  const rec1001 = byCode('1001');
  const rec1002 = byCode('1002');
  const sara = byCode('HR-2024-000123');
  service.applyDeviceResults([
    { key: rec1001.id, status: 'created', uid: 30 },
    { key: rec1002.id, status: 'exists', uid: 4, deviceName: 'Someone Else' },
    { key: sara.id, status: 'failed', error: 'timeout' }
  ]);
  assert.equal(byCode('1001').status, 'synced');
  assert.equal(byCode('1001').deviceUid, 30);
  assert.equal(byCode('1002').status, 'on_device');
  assert.match(byCode('1002').lastError, /Someone Else/);
  assert.equal(byCode('HR-2024-000123').status, 'failed');
  assert.equal(service.getApproved().length, 0);
  assert.equal(service.approve(['1001']).length, 0, 'synced employees cannot be re-approved');

  assert.throws(() => service.setDeviceUserId(rec1001.id, '5555'), /on the device/);
  const res = service.receive({ central_uid: 'c-1002', device_user_id: '7777', full_name: 'Omar' });
  assert.equal(byCode('1002').deviceUserId, '1002');
  assert.ok(res.warnings.some(w => /already on the device/.test(w.message)));
});

test('remove accepts the original employee code reference', () => {
  assert.equal(service.remove('901'), true);
  assert.equal(service.remove('901'), false);
  assert.ok(existsSync(file('receivedEmployees.v1.backup.json')));
});

test('deleting a device user unlocks the matching received employee', () => {
  assert.equal(byCode('1001').status, 'synced');
  assert.equal(service.markRemovedFromDevice('1001'), 1);
  const rec = byCode('1001');
  assert.equal(rec.status, 'pending');
  assert.equal(rec.deviceUid, null);
  assert.equal(service.markRemovedFromDevice('1001'), 0);
  assert.equal(service.approve(['1001']).length, 1);
});
