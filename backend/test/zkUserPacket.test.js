import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { encodeUserPacket72, truncateUtf8, USER_PACKET_SIZE } from '../src/utils/zkUserPacket.js';

const require = createRequire(import.meta.url);
const { decodeUserData72 } = require('node-zklib/utils.js');

test('user packet round-trips through node-zklib decoder', () => {
  const packet = encodeUserPacket72({ uid: 27, userId: '100245', name: 'Ahmed Ali' });
  assert.equal(packet.length, USER_PACKET_SIZE);
  const user = decodeUserData72(packet);
  assert.equal(user.uid, 27);
  assert.equal(user.userId, '100245');
  assert.equal(user.name, 'Ahmed Ali');
  assert.equal(user.role, 0);
});

test('long names are truncated without splitting UTF-8 characters', () => {
  const name = truncateUtf8('محمد عبدالله الشهري', 23);
  assert.ok(Buffer.byteLength(name, 'utf8') <= 23);
  assert.ok(!name.includes('�'));
  assert.equal(Buffer.from(name, 'utf8').toString('utf8'), name);
});

test('rejects ids the device cannot store or read back', () => {
  assert.throws(() => encodeUserPacket72({ uid: 1, userId: '1234567890', name: 'x' }));
  assert.throws(() => encodeUserPacket72({ uid: 0, userId: '1', name: 'x' }));
  assert.throws(() => encodeUserPacket72({ uid: 70000, userId: '1', name: 'x' }));
});

test('renaming keeps every other byte of the device record', async () => {
  const { withUserName, uidBuffer } = await import('../src/utils/zkUserPacket.js');
  const original = encodeUserPacket72({ uid: 9, userId: '23', name: 'A much longer old name', role: 14, password: '1234', cardno: 7504885 });
  original.write('1', 40, 7, 'ascii'); // group id
  const renamed = withUserName(original, 'Diaa');
  const user = decodeUserData72(renamed);
  assert.equal(user.name, 'Diaa');
  assert.equal(user.uid, 9);
  assert.equal(user.userId, '23');
  assert.equal(user.role, 14);
  assert.equal(user.password, '1234');
  assert.equal(user.cardno, 7504885);
  assert.deepEqual(renamed.subarray(35), original.subarray(35));
  assert.deepEqual(renamed.subarray(0, 11), original.subarray(0, 11));
  assert.deepEqual([...uidBuffer(300)], [44, 1]);
  assert.throws(() => uidBuffer(0));
});
