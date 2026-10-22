import ZKLib from 'node-zklib';
import dotenv from 'dotenv';
import { deviceConfig } from '../config/deviceConfig.js';
import {
  CMD_USER_WRQ,
  CMD_DELETE_USER,
  CMD_REFRESHDATA,
  CMD_ACK_OK,
  MAX_DEVICE_UID,
  USER_PACKET_SIZE,
  GET_USERS_REQUEST,
  encodeUserPacket72,
  withUserName,
  uidBuffer
} from '../utils/zkUserPacket.js';

function deviceError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode });
}

async function expectAck(zk, command, data) {
  const reply = await zk.executeCmd(command, data);
  const replyCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : null;
  if (replyCode !== CMD_ACK_OK) {
    throw new Error(`Device rejected the command (reply code ${replyCode})`);
  }
}

dotenv.config();

class ZKService {
  constructor() {
    this.ip = deviceConfig.ip;
    this.port = deviceConfig.port;
    this.timeout = parseInt(process.env.ZK_TIMEOUT || '10000', 10);
    this.inPort = parseInt(process.env.ZK_IN_PORT || '5200', 10);
    this.zkInstance = null;
    this.isConnected = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Run device user writes one at a time so uid allocation and edits never interleave
   */
  withWriteLock(operation) {
    const run = this.writeQueue.then(operation, operation);
    this.writeQueue = run.catch(() => {});
    return run;
  }

  /**
   * Helper to execute operations with safe connect/disconnect lifecycle
   */
  async executeWithDevice(operationCallback) {
    const zk = new ZKLib(this.ip, this.port, this.timeout, this.inPort);
    try {
      await zk.createSocket();
      const result = await operationCallback(zk);
      await zk.disconnect();
      return result;
    } catch (error) {
      try {
        await zk.disconnect();
      } catch (err) {
        // Ignore secondary disconnect error
      }
      throw error;
    }
  }

  /**
   * Test connection and retrieve device basic info
   */
  async getDeviceInfo() {
    return await this.executeWithDevice(async (zk) => {
      let info = {};
      try {
        info = await zk.getInfo();
      } catch (err) {
        info = { note: 'Extended info not available' };
      }

      return {
        ip: this.ip,
        port: this.port,
        connectionType: zk.connectionType,
        status: 'online',
        deviceInfo: info
      };
    });
  }

  /**
   * Get all registered users from device
   */
  async getUsers() {
    return await this.executeWithDevice(async (zk) => {
      const usersData = await zk.getUsers();
      return usersData.data || usersData;
    });
  }

  /**
   * Get attendance punch logs
   */
  async getAttendances() {
    return await this.executeWithDevice(async (zk) => {
      const attendancesData = await zk.getAttendances();
      const logs = attendancesData.data || attendancesData;
      return logs;
    });
  }

  /**
   * Clear all attendance records from device
   */
  async clearAttendanceLogs() {
    return await this.executeWithDevice(async (zk) => {
      await zk.clearAttendanceLog();
      return { success: true, message: 'Device attendance logs cleared successfully' };
    });
  }

  /**
   * Disable/Lock device inputs
   */
  async disableDevice() {
    return await this.executeWithDevice(async (zk) => {
      await zk.disableDevice();
      return { success: true, message: 'Device disabled' };
    });
  }

  /**
   * Enable device inputs
   */
  async enableDevice() {
    return await this.executeWithDevice(async (zk) => {
      await zk.enableDevice();
      return { success: true, message: 'Device enabled' };
    });
  }

  /**
   * Set device clock
   */
  async setTime(date = new Date()) {
    return await this.executeWithDevice(async (zk) => {
      // CMD_SET_TIME = 202
      // Time format: (year - 2000) * 12 * 31 + ((month - 1) * 31) + day - 1) * (24 * 60 * 60) + (hour * 60 + minute) * 60 + second
      const t = Math.floor(
        ((date.getFullYear() % 100) * 12 * 31 + date.getMonth() * 31 + date.getDate() - 1) * 86400 +
        date.getHours() * 3600 +
        date.getMinutes() * 60 +
        date.getSeconds()
      );
      const buf = Buffer.alloc(4);
      buf.writeUInt32LE(t, 0);
      await zk.executeCmd(202, buf);
      return { success: true, message: `Device clock set to ${date.toISOString()}` };
    });
  }

  /**
   * Restart device
   */
  async restartDevice() {
    return await this.executeWithDevice(async (zk) => {
      // CMD_RESTART = 1004
      await zk.executeCmd(1004, '');
      return { success: true, message: 'Device restarting...' };
    });
  }

  /**
   * Add employees as new device users. Users whose id already exists on the
   * device are reported as 'exists' and never written, so nothing is overwritten.
   * Each employee is { key, deviceUserId, name }; results carry the same key.
   */
  async addUsersIfMissing(employees) {
    return await this.withWriteLock(() => this.executeWithDevice(async (zk) => {
      const usersData = await zk.getUsers();
      // A partial user list would make the duplicate check unreliable
      if (usersData.err) {
        throw new Error(`Could not read the full user list from device: ${usersData.err.message || usersData.err}`);
      }
      const deviceUsers = usersData.data || usersData;
      const existing = new Map(deviceUsers.map(u => [String(u.userId), { uid: u.uid, name: u.name }]));
      let nextUid = deviceUsers.reduce((max, u) => Math.max(max, u.uid || 0), 0) + 1;

      const results = [];
      let written = false;
      for (const emp of employees) {
        const base = { key: emp.key, deviceUserId: emp.deviceUserId };
        const found = existing.get(emp.deviceUserId);
        if (found) {
          results.push({ ...base, status: 'exists', uid: found.uid, deviceName: found.name || '' });
          continue;
        }
        if (nextUid > MAX_DEVICE_UID) {
          results.push({ ...base, status: 'failed', error: 'No free user slot (uid) on device' });
          continue;
        }
        try {
          const packet = encodeUserPacket72({ uid: nextUid, userId: emp.deviceUserId, name: emp.name });
          const reply = await zk.executeCmd(CMD_USER_WRQ, packet);
          const replyCode = reply && reply.length >= 2 ? reply.readUInt16LE(0) : null;
          if (replyCode !== CMD_ACK_OK) {
            throw new Error(`Device rejected the user (reply code ${replyCode})`);
          }
          results.push({ ...base, status: 'created', uid: nextUid });
          existing.set(emp.deviceUserId, { uid: nextUid, name: emp.name });
          nextUid++;
          written = true;
        } catch (error) {
          const message = typeof error?.toast === 'function' ? error.toast() : error?.message;
          results.push({ ...base, status: 'failed', error: message || String(error) });
        }
      }

      if (written) await zk.executeCmd(CMD_REFRESHDATA, '');
      return results;
    }));
  }

  /**
   * Rename a device user. The user's own 72-byte record is read back and only its
   * name bytes are replaced, so role, PIN, card, group and fingerprints are kept.
   * userId must still match the uid, guarding against a stale screen.
   */
  async renameUser(uid, userId, name) {
    return await this.withWriteLock(() => this.executeWithDevice(async (zk) => {
      if (zk.connectionType !== 'tcp') {
        throw deviceError('Editing users requires a TCP connection to the device', 409);
      }
      const tcp = zk.zklibTcp;
      await tcp.freeData();
      const data = await tcp.readWithBuffer(GET_USERS_REQUEST);
      await tcp.freeData();
      if (data.err) {
        throw new Error(`Could not read the full user list from device: ${data.err.message || data.err}`);
      }

      const records = data.data.subarray(4);
      let record = null;
      for (let offset = 0; offset + USER_PACKET_SIZE <= records.length; offset += USER_PACKET_SIZE) {
        const candidate = records.subarray(offset, offset + USER_PACKET_SIZE);
        if (candidate.readUInt16LE(0) === uid) {
          record = candidate;
          break;
        }
      }
      if (!record) throw deviceError('User not found on device', 404);
      const deviceUserId = record.subarray(48, 57).toString('ascii').split('\0').shift();
      if (deviceUserId !== String(userId)) {
        throw deviceError('This user changed on the device; refresh and try again', 409);
      }

      await expectAck(zk, CMD_USER_WRQ, withUserName(record, name));
      await zk.executeCmd(CMD_REFRESHDATA, '');
      return { uid, userId: deviceUserId, name };
    }));
  }

  /**
   * Delete a device user (and its fingerprints). Attendance logs already on the
   * device are not removed. userId must still match the uid.
   */
  async deleteUser(uid, userId) {
    return await this.withWriteLock(() => this.executeWithDevice(async (zk) => {
      const usersData = await zk.getUsers();
      if (usersData.err) {
        throw new Error(`Could not read the full user list from device: ${usersData.err.message || usersData.err}`);
      }
      const user = (usersData.data || usersData).find(u => u.uid === uid);
      if (!user) throw deviceError('User not found on device', 404);
      if (String(user.userId) !== String(userId)) {
        throw deviceError('This user changed on the device; refresh and try again', 409);
      }

      await expectAck(zk, CMD_DELETE_USER, uidBuffer(uid));
      await zk.executeCmd(CMD_REFRESHDATA, '');
      return { uid, userId: String(user.userId), name: user.name };
    }));
  }

  /**
   * Execute custom/raw command
   */
  async executeCustomCommand(commandId, data = '') {
    return await this.executeWithDevice(async (zk) => {
      const result = await zk.executeCmd(commandId, data);
      return { success: true, commandId, result };
    });
  }
}

export const zkService = new ZKService();
export default zkService;
