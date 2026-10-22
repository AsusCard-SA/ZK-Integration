import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { DEVICE_USER_ID_PATTERN } from '../utils/zkUserPacket.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Same data directory as the Edara server store, so each deployment profile
// (e.g. the Saudi F22 profile) keeps its own token and employee list.
const DATA_DIR = process.env.EDARA_DATA_DIR
  ? path.resolve(process.env.EDARA_DATA_DIR)
  : path.resolve(__dirname, '../../data');
const SETTINGS_FILE = path.join(DATA_DIR, 'employeeApiSettings.json');
const EMPLOYEES_FILE = path.join(DATA_DIR, 'receivedEmployees.json');
// Copy of the original file taken before records in the first format are rewritten
const EMPLOYEES_V1_BACKUP = path.join(DATA_DIR, 'receivedEmployees.v1.backup.json');

const MAX_BATCH = 1000;
const MAX_TEXT = 100;
const MAX_ID = 100;

export const EMPLOYEE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SYNCED: 'synced',
  ON_DEVICE: 'on_device',
  FAILED: 'failed'
};

// Once a user is on the device its device id must not change
const ON_DEVICE_STATUSES = new Set([EMPLOYEE_STATUS.SYNCED, EMPLOYEE_STATUS.ON_DEVICE]);
// Changes to these fields require the employee to be approved again
const REAPPROVAL_FIELDS = new Set(['name', 'deviceUserId', 'active']);
const UPDATABLE_FIELDS = ['employeeCode', 'name', 'company', 'companyId', 'branch', 'branchId', 'active'];

const DEFAULT_SETTINGS = { enabled: false, tokenHash: '', tokenHint: '', tokenCreatedAt: null };

const has = (obj, ...keys) => keys.find(k => Object.prototype.hasOwnProperty.call(obj, k));

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest();
}

function cleanText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim().slice(0, MAX_TEXT);
}

function newRecordId() {
  return `emp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Identifiers are never truncated; an over-long id is an error, not a shorter id.
 */
function readId(raw, keys, label) {
  const key = has(raw, ...keys);
  if (key === undefined || raw[key] === null || raw[key] === '') return { value: null };
  if (typeof raw[key] !== 'string' && typeof raw[key] !== 'number') {
    return { error: `${label} must be a string or number` };
  }
  const value = String(raw[key]).trim();
  if (value.length > MAX_ID) return { error: `${label} must be at most ${MAX_ID} characters` };
  return { value: value || null };
}

/**
 * company_id / branch_id are kept exactly as sent (string, number or null).
 */
function readReference(raw, keys, label) {
  const key = has(raw, ...keys);
  if (key === undefined) return { present: false };
  const value = raw[key];
  if (value === null || typeof value === 'number') return { present: true, value };
  if (typeof value === 'string') return { present: true, value: value.trim().slice(0, MAX_ID) };
  return { error: `${label} must be a string, number or null` };
}

function readActive(raw) {
  const key = has(raw, 'active', 'is_active', 'isActive');
  if (key === undefined || raw[key] === null) return { present: false };
  const value = raw[key];
  if (value === true || value === 1 || value === 'true' || value === '1') return { present: true, value: true };
  if (value === false || value === 0 || value === 'false' || value === '0') return { present: true, value: false };
  return { error: 'active must be true or false' };
}

/**
 * Accepts the field names ZK Central or other HR tools commonly use.
 * Only fields present in the payload are returned, so updates never blank out
 * values the sender did not include.
 */
export function normalizeEmployee(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Employee entry must be an object' };
  }

  const central = readId(raw, ['central_uid', 'centralUid'], 'central_uid');
  const code = readId(raw, ['employee_code', 'employeeCode', 'employee_id', 'employeeId'], 'employee_code');
  const device = readId(raw, ['device_user_id', 'deviceUserId', 'device_id', 'deviceId'], 'device_user_id');
  const ref = { centralUid: central.value || null, employeeCode: code.value || null };
  const idError = central.error || code.error || device.error;
  if (idError) return { ...ref, error: idError };
  if (!ref.centralUid && !ref.employeeCode) return { error: 'central_uid or employee_code is required' };

  if (device.value && !DEVICE_USER_ID_PATTERN.test(device.value)) {
    return { ...ref, error: 'device_user_id must be 1-9 letters or digits (device limit)' };
  }

  const fields = {};
  if (ref.employeeCode) fields.employeeCode = ref.employeeCode;

  const nameKey = has(raw, 'name', 'full_name', 'fullName', 'employeeName', 'employee_name');
  if (nameKey !== undefined) fields.name = cleanText(raw[nameKey]);

  const companyKey = has(raw, 'company', 'companyName', 'company_name');
  if (companyKey !== undefined) fields.company = cleanText(raw[companyKey]);
  const branchKey = has(raw, 'branch', 'branchName', 'branch_name');
  if (branchKey !== undefined) fields.branch = cleanText(raw[branchKey]);

  const companyId = readReference(raw, ['company_id', 'companyId'], 'company_id');
  const branchId = readReference(raw, ['branch_id', 'branchId'], 'branch_id');
  const active = readActive(raw);
  const fieldError = companyId.error || branchId.error || active.error;
  if (fieldError) return { ...ref, error: fieldError };
  if (companyId.present) fields.companyId = companyId.value;
  if (branchId.present) fields.branchId = branchId.value;
  if (active.present) fields.active = active.value;

  // Explicit device id wins; otherwise an HR code that fits the device is reused
  let deviceUserId = device.value || null;
  let deviceIdSource = deviceUserId ? 'explicit' : null;
  if (!deviceUserId && ref.employeeCode && DEVICE_USER_ID_PATTERN.test(ref.employeeCode)) {
    deviceUserId = ref.employeeCode;
    deviceIdSource = 'employee_code';
  }

  return { ...ref, employee: { fields, deviceUserId, deviceIdSource } };
}

/**
 * Bring stored records to the current shape. Records from the first format only
 * had employeeId, which served as both HR code and device id.
 */
function migrateRecord(rec) {
  if (rec.id) return rec;
  return {
    id: `legacy_${rec.employeeId}`,
    centralUid: null,
    employeeCode: rec.employeeId,
    deviceUserId: rec.employeeId,
    companyId: null,
    branchId: null,
    active: true,
    ...rec
  };
}

class EmployeeReceiveService {
  ensureStorage() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
    }
  }

  readJson(file, fallback) {
    this.ensureStorage();
    if (!fs.existsSync(file)) return fallback;
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (error) {
      console.error(`Error reading ${path.basename(file)}:`, error.message);
      return fallback;
    }
  }

  /**
   * Atomic, owner-only write (temp file + rename)
   */
  writeJson(file, data) {
    this.ensureStorage();
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 });
    fs.renameSync(tmp, file);
  }

  // ---------- Settings & token ----------

  getSettings() {
    return { ...DEFAULT_SETTINGS, ...this.readJson(SETTINGS_FILE, {}) };
  }

  getPublicSettings() {
    const { tokenHash, ...rest } = this.getSettings();
    return { ...rest, hasToken: Boolean(tokenHash) };
  }

  /**
   * Generates a new token. Only its SHA-256 hash is stored, so the plain
   * token is returned exactly once and any previous token stops working.
   */
  generateToken() {
    const token = `zkc_${crypto.randomBytes(32).toString('base64url')}`;
    const settings = this.getSettings();
    this.writeJson(SETTINGS_FILE, {
      ...settings,
      tokenHash: hashToken(token).toString('hex'),
      tokenHint: `••••${token.slice(-4)}`,
      tokenCreatedAt: new Date().toISOString()
    });
    return token;
  }

  setEnabled(enabled) {
    const settings = this.getSettings();
    if (enabled && !settings.tokenHash) {
      throw new Error('Generate an API token before enabling the receiving API');
    }
    this.writeJson(SETTINGS_FILE, { ...settings, enabled: Boolean(enabled) });
    return this.getPublicSettings();
  }

  verifyToken(token) {
    const { tokenHash } = this.getSettings();
    if (!tokenHash || !token) return false;
    const expected = Buffer.from(tokenHash, 'hex');
    const actual = hashToken(token);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  // ---------- Received employees ----------

  getEmployees() {
    const list = this.readJson(EMPLOYEES_FILE, []);
    return Array.isArray(list) ? list.map(migrateRecord) : [];
  }

  saveEmployees(list) {
    // Keep the untouched first-format file once, before it is rewritten
    if (!fs.existsSync(EMPLOYEES_V1_BACKUP)) {
      const stored = this.readJson(EMPLOYEES_FILE, []);
      if (Array.isArray(stored) && stored.some(rec => !rec.id)) {
        fs.copyFileSync(EMPLOYEES_FILE, EMPLOYEES_V1_BACKUP);
      }
    }
    this.writeJson(EMPLOYEES_FILE, list);
  }

  /**
   * A reference may be a record id, central_uid or HR employee code
   * (the latter keeps the original employeeId-based calls working).
   */
  matches(rec, refs) {
    return refs.has(rec.id) || (rec.centralUid && refs.has(rec.centralUid)) || (rec.employeeCode && refs.has(rec.employeeCode));
  }

  /**
   * Store new employees and safely update ones identified by central_uid.
   * Entries without central_uid keep the original behaviour: an existing
   * employee code is reported as a duplicate and left unchanged.
   */
  receive(payload) {
    const entries = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.employees) ? payload.employees : [payload];

    if (entries.length === 0) throw new Error('No employees in request body');
    if (entries.length > MAX_BATCH) throw new Error(`A maximum of ${MAX_BATCH} employees can be sent per request`);

    const list = this.getEmployees();
    const now = new Date().toISOString();
    const meta = {
      source: cleanText(payload?.source) || null,
      requestId: cleanText(payload?.request_id ?? payload?.requestId) || null
    };
    const summary = { received: entries.length, created: [], updated: [], duplicates: [], invalid: [], warnings: [], results: [] };
    let dirty = false;

    entries.forEach((raw, index) => {
      const { employee, centralUid, employeeCode, error } = normalizeEmployee(raw);
      const label = employeeCode || centralUid;
      const result = { index, central_uid: centralUid || null, employee_code: employeeCode || null };
      const warn = (message) => summary.warnings.push({ index, employee: label, message });
      const reject = (message) => {
        summary.invalid.push({ index, employeeId: label || null, error: message });
        summary.results.push({ ...result, action: 'invalid', error: message });
      };
      if (error) return reject(error);

      const byCentral = centralUid ? list.find(r => r.centralUid === centralUid) : null;
      const byCode = employeeCode ? list.find(r => r.employeeCode === employeeCode) : null;

      let target = byCentral;
      if (!target && byCode) {
        if (!centralUid) {
          summary.duplicates.push(label);
          summary.results.push({ ...result, id: byCode.id, device_user_id: byCode.deviceUserId, action: 'duplicate' });
          return;
        }
        if (byCode.centralUid && byCode.centralUid !== centralUid) {
          return reject(`employee_code ${employeeCode} already belongs to another central_uid`);
        }
        // Record created before ZK Central sent central_uid: link it
        target = byCode;
      }
      if (target && byCode && byCode !== target) {
        return reject(`employee_code ${employeeCode} already belongs to another employee`);
      }

      const deviceIdTaken = (id, self) => id && list.some(r => r !== self && r.deviceUserId === id);

      if (!target) {
        const { fields } = employee;
        if (!fields.name) return reject('name is required');
        let { deviceUserId } = employee;
        if (deviceIdTaken(deviceUserId, null)) {
          warn(`Device ID ${deviceUserId} is already used by another employee; assign one manually`);
          deviceUserId = null;
        } else if (!deviceUserId) {
          warn('employee_code does not fit the device (1-9 letters or digits); assign a device ID before approval');
        }
        const rec = {
          id: newRecordId(),
          centralUid: centralUid || null,
          employeeCode: employeeCode || null,
          // Kept for clients of the first format, where it held the device id
          employeeId: deviceUserId || employeeCode || null,
          deviceUserId,
          name: fields.name,
          company: fields.company || '',
          companyId: fields.companyId ?? null,
          branch: fields.branch || '',
          branchId: fields.branchId ?? null,
          active: fields.active ?? true,
          status: EMPLOYEE_STATUS.PENDING,
          deviceUid: null,
          lastError: '',
          source: meta.source,
          lastRequestId: meta.requestId,
          receivedAt: now,
          updatedAt: now,
          approvedAt: null,
          syncedAt: null
        };
        list.push(rec);
        dirty = true;
        summary.created.push(label);
        summary.results.push({ ...result, id: rec.id, device_user_id: deviceUserId, action: 'created' });
        return;
      }

      // ----- Safe update of an existing record -----
      const changes = {};
      for (const key of UPDATABLE_FIELDS) {
        if (key in employee.fields && employee.fields[key] !== target[key]) changes[key] = employee.fields[key];
      }
      if ('name' in changes && !changes.name) {
        delete changes.name;
        warn('Empty name ignored; existing name kept');
      }
      if (centralUid && !target.centralUid) changes.centralUid = centralUid;

      const wanted = employee.deviceIdSource === 'explicit' || !target.deviceUserId ? employee.deviceUserId : null;
      if (wanted && wanted !== target.deviceUserId) {
        if (ON_DEVICE_STATUSES.has(target.status)) {
          warn(`Device ID stays ${target.deviceUserId} because the employee is already on the device`);
        } else if (deviceIdTaken(wanted, target)) {
          warn(`Device ID ${wanted} is already used by another employee; kept ${target.deviceUserId || 'unassigned'}`);
        } else {
          changes.deviceUserId = wanted;
        }
      }

      const changedKeys = Object.keys(changes);
      if (changedKeys.length === 0) {
        summary.duplicates.push(label);
        summary.results.push({ ...result, id: target.id, device_user_id: target.deviceUserId, action: 'unchanged' });
        return;
      }

      if (target.status === EMPLOYEE_STATUS.APPROVED && changedKeys.some(k => REAPPROVAL_FIELDS.has(k))) {
        changes.status = EMPLOYEE_STATUS.PENDING;
        changes.approvedAt = null;
        warn('Details changed after approval; approve again before sending to the device');
      }
      if (ON_DEVICE_STATUSES.has(target.status) && ('name' in changes || changes.active === false)) {
        warn('Employee is already on the device; the device user is not changed automatically');
      }
      if ('deviceUserId' in changes || 'employeeCode' in changes) {
        changes.employeeId = changes.deviceUserId || target.deviceUserId || changes.employeeCode || target.employeeCode;
      }

      Object.assign(target, changes, {
        source: meta.source ?? target.source ?? null,
        lastRequestId: meta.requestId ?? target.lastRequestId ?? null,
        updatedAt: now
      });
      dirty = true;
      summary.updated.push(label);
      summary.results.push({ ...result, id: target.id, device_user_id: target.deviceUserId, action: byCentral ? 'updated' : 'linked', changed: changedKeys });
    });

    if (dirty) this.saveEmployees(list);
    return { ...summary, request_id: meta.requestId };
  }

  updateEmployees(refs, updater) {
    const refSet = new Set(refs.map(String));
    const list = this.getEmployees();
    const changed = [];
    const now = new Date().toISOString();
    list.forEach((emp, i) => {
      if (!this.matches(emp, refSet)) return;
      const next = updater(emp, now);
      if (next) {
        list[i] = { ...emp, ...next, updatedAt: now };
        changed.push(list[i]);
      }
    });
    if (changed.length > 0) this.saveEmployees(list);
    return changed;
  }

  /**
   * Approve pending (or previously failed) active employees that have a device ID.
   */
  approve(refs) {
    return this.updateEmployees(refs, (emp, now) => (
      (emp.status === EMPLOYEE_STATUS.PENDING || emp.status === EMPLOYEE_STATUS.FAILED) && emp.active !== false && emp.deviceUserId
        ? { status: EMPLOYEE_STATUS.APPROVED, approvedAt: now, lastError: '' }
        : null
    ));
  }

  /**
   * Assign the device user id by hand (e.g. when the HR code is longer than 9 characters).
   */
  setDeviceUserId(ref, deviceUserId) {
    const value = String(deviceUserId ?? '').trim();
    if (!DEVICE_USER_ID_PATTERN.test(value)) {
      throw new Error('Device ID must be 1-9 letters or digits');
    }
    const list = this.getEmployees();
    const refSet = new Set([String(ref)]);
    const rec = list.find(r => this.matches(r, refSet));
    if (!rec) return null;
    if (ON_DEVICE_STATUSES.has(rec.status)) {
      throw new Error('Device ID cannot change after the employee is on the device');
    }
    if (list.some(r => r !== rec && r.deviceUserId === value)) {
      throw new Error(`Device ID ${value} is already used by another employee`);
    }
    if (rec.deviceUserId === value) return rec;
    Object.assign(rec, {
      deviceUserId: value,
      employeeId: value,
      status: EMPLOYEE_STATUS.PENDING,
      approvedAt: null,
      updatedAt: new Date().toISOString()
    });
    this.saveEmployees(list);
    return rec;
  }

  remove(ref) {
    const refSet = new Set([String(ref)]);
    const list = this.getEmployees();
    const next = list.filter(e => !this.matches(e, refSet));
    if (next.length === list.length) return false;
    this.saveEmployees(next);
    return true;
  }

  getApproved(refs) {
    const refSet = refs ? new Set(refs.map(String)) : null;
    return this.getEmployees().filter(e => (
      e.status === EMPLOYEE_STATUS.APPROVED && e.active !== false && e.deviceUserId && (!refSet || this.matches(e, refSet))
    ));
  }

  /**
   * A user was deleted on the device: unlock matching received employees so they
   * can be approved and sent again.
   */
  markRemovedFromDevice(deviceUserId) {
    const list = this.getEmployees();
    const now = new Date().toISOString();
    let changed = 0;
    list.forEach(rec => {
      if (rec.deviceUserId !== String(deviceUserId) || !ON_DEVICE_STATUSES.has(rec.status)) return;
      Object.assign(rec, {
        status: EMPLOYEE_STATUS.PENDING,
        deviceUid: null,
        approvedAt: null,
        syncedAt: null,
        lastError: 'Deleted from device',
        updatedAt: now
      });
      changed++;
    });
    if (changed > 0) this.saveEmployees(list);
    return changed;
  }

  /**
   * Record per-employee results returned by zkService.addUsersIfMissing (keyed by record id)
   */
  applyDeviceResults(results) {
    const byId = new Map(results.map(r => [r.key, r]));
    return this.updateEmployees([...byId.keys()], (emp, now) => {
      const r = byId.get(emp.id);
      if (!r) return null;
      if (r.status === 'created') {
        return { status: EMPLOYEE_STATUS.SYNCED, deviceUid: r.uid, syncedAt: now, lastError: '' };
      }
      if (r.status === 'exists') {
        const who = r.deviceName ? ` (device name: ${r.deviceName})` : '';
        return { status: EMPLOYEE_STATUS.ON_DEVICE, deviceUid: r.uid, lastError: `Device ID ${emp.deviceUserId} already registered on device${who}; left unchanged` };
      }
      return { status: EMPLOYEE_STATUS.FAILED, lastError: r.error || 'Unknown device error' };
    });
  }
}

export const employeeReceiveService = new EmployeeReceiveService();
export default employeeReceiveService;
