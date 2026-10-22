// ZK protocol command ids used for writing users (see node-zklib/constants.js)
export const CMD_USER_WRQ = 8;
export const CMD_DELETE_USER = 18;
export const CMD_REFRESHDATA = 1013;
export const CMD_ACK_OK = 2000;

export const USER_PACKET_SIZE = 72;
// Same request node-zklib sends for getUsers (REQUEST_DATA.GET_USERS)
export const GET_USERS_REQUEST = Buffer.from([0x01, 0x09, 0x00, 0x05, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
export const MAX_DEVICE_UID = 65535;
const NAME_BYTES = 24;

// node-zklib reads back only 9 bytes of the user id, so longer ids could not be
// matched against existing device users and would risk duplicates.
export const DEVICE_USER_ID_PATTERN = /^[A-Za-z0-9]{1,9}$/;

/**
 * Truncate a UTF-8 string to maxBytes without cutting a multi-byte character.
 */
export function truncateUtf8(value, maxBytes) {
  let out = '';
  let size = 0;
  for (const ch of String(value || '')) {
    const len = Buffer.byteLength(ch, 'utf8');
    if (size + len > maxBytes) break;
    out += ch;
    size += len;
  }
  return out;
}

/**
 * Build the 72-byte user record (pyzk layout "<HB8s24sIx7sx24s"):
 * uid(2) role(1) password(8) name(24) card(4) pad(1) group(7) pad(1) userId(24)
 */
export function encodeUserPacket72({ uid, userId, name, role = 0, password = '', cardno = 0 }) {
  if (!Number.isInteger(uid) || uid < 1 || uid > MAX_DEVICE_UID) {
    throw new Error(`Invalid device uid: ${uid}`);
  }
  if (!DEVICE_USER_ID_PATTERN.test(String(userId))) {
    throw new Error(`Invalid device user id: ${userId}`);
  }

  const buf = Buffer.alloc(USER_PACKET_SIZE);
  buf.writeUInt16LE(uid, 0);
  buf.writeUInt8(role, 2);
  buf.write(String(password).slice(0, 8), 3, 8, 'ascii');
  // Keep one byte for the terminating null
  buf.write(truncateUtf8(name, NAME_BYTES - 1), 11, NAME_BYTES, 'utf8');
  buf.writeUInt32LE(cardno, 35);
  buf.write(String(userId), 48, 24, 'ascii');
  return buf;
}

/**
 * Copy of an existing 72-byte user record with only the name bytes replaced,
 * so role, password, card, group and user id stay exactly as on the device.
 */
export function withUserName(packet, name) {
  if (!Buffer.isBuffer(packet) || packet.length !== USER_PACKET_SIZE) {
    throw new Error('Expected a 72-byte user record');
  }
  const out = Buffer.from(packet);
  out.fill(0, 11, 11 + NAME_BYTES);
  out.write(truncateUtf8(name, NAME_BYTES - 1), 11, NAME_BYTES, 'utf8');
  return out;
}

export function uidBuffer(uid) {
  if (!Number.isInteger(uid) || uid < 1 || uid > MAX_DEVICE_UID) {
    throw new Error(`Invalid device uid: ${uid}`);
  }
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(uid, 0);
  return buf;
}
