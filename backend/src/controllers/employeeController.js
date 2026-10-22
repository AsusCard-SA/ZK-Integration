import os from 'os';
import employeeReceiveService from '../services/employeeReceiveService.js';
import zkService from '../services/zkService.js';

let pushInProgress = false;

// node-zklib rejects with ZKError objects, which carry no .message of their own
function errorText(error) {
  if (typeof error?.toast === 'function') return error.toast();
  return error?.message || String(error);
}

/**
 * Candidate URLs ZK Central can use to reach this server. PUBLIC_BASE_URL wins
 * when set (e.g. behind a reverse proxy); otherwise LAN IPv4 addresses are listed.
 */
function receiveUrls() {
  const pathName = '/api/employees/receive';
  if (process.env.PUBLIC_BASE_URL) {
    return [`${process.env.PUBLIC_BASE_URL.replace(/\/+$/, '')}${pathName}`];
  }
  const port = process.env.PORT || 5000;
  const hosts = Object.values(os.networkInterfaces())
    .flat()
    .filter(iface => iface && iface.family === 'IPv4' && !iface.internal)
    .map(iface => iface.address);
  return [...new Set([...hosts, 'localhost'])].map(host => `http://${host}:${port}${pathName}`);
}

/**
 * Rejects requests while the API is disabled or the Bearer token is wrong.
 */
export const requireReceiveAuth = (req, res, next) => {
  if (!employeeReceiveService.getSettings().enabled) {
    return res.status(503).json({ success: false, message: 'Employee receiving API is disabled' });
  }
  const match = /^Bearer\s+(.+)$/i.exec(req.get('authorization') || '');
  if (!match || !employeeReceiveService.verifyToken(match[1].trim())) {
    res.set('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ success: false, message: 'Invalid or missing Bearer token' });
  }
  next();
};

export const receiveEmployees = (req, res) => {
  try {
    const result = employeeReceiveService.receive(req.body);
    const status = result.created.length > 0 ? 201 : (result.invalid.length === result.received ? 400 : 200);
    res.status(status).json({
      success: result.invalid.length < result.received,
      message: `Received ${result.received}: ${result.created.length} new, ${result.updated.length} updated, ${result.duplicates.length} duplicate, ${result.invalid.length} invalid`,
      ...result
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * Read-only check for ZK Central; reached only after requireReceiveAuth passes.
 */
export const receiveHealth = (req, res) => {
  res.json({
    success: true,
    service: 'ZK-Integration',
    employee_receiving: 'enabled'
  });
};

export const getApiSettings = (req, res) => {
  res.json({
    success: true,
    data: { ...employeeReceiveService.getPublicSettings(), receiveUrls: receiveUrls() }
  });
};

export const updateApiSettings = (req, res) => {
  try {
    if (typeof req.body?.enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'enabled (boolean) is required' });
    }
    const data = employeeReceiveService.setEnabled(req.body.enabled);
    res.json({ success: true, data: { ...data, receiveUrls: receiveUrls() } });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const generateApiToken = (req, res) => {
  const token = employeeReceiveService.generateToken();
  res.status(201).json({
    success: true,
    message: 'New token generated. Copy it now; it will not be shown again.',
    token,
    data: { ...employeeReceiveService.getPublicSettings(), receiveUrls: receiveUrls() }
  });
};

export const getReceivedEmployees = (req, res) => {
  const data = employeeReceiveService.getEmployees();
  res.json({ success: true, count: data.length, data });
};

// Record ids, central_uids or employee codes; "employeeIds" is the original field name
function refsFrom(body) {
  const refs = Array.isArray(body?.ids) ? body.ids : body?.employeeIds;
  return Array.isArray(refs) && refs.length > 0 ? refs : null;
}

export const approveEmployees = (req, res) => {
  const refs = refsFrom(req.body);
  if (!refs) {
    return res.status(400).json({ success: false, message: 'ids (non-empty array) is required' });
  }
  const changed = employeeReceiveService.approve(refs);
  res.json({ success: true, message: `${changed.length} employee(s) approved`, data: changed });
};

export const setEmployeeDeviceUserId = (req, res) => {
  try {
    const rec = employeeReceiveService.setDeviceUserId(req.params.ref, req.body?.deviceUserId);
    if (!rec) return res.status(404).json({ success: false, message: 'Employee not found' });
    res.json({ success: true, message: `Device ID set to ${rec.deviceUserId}`, data: rec });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteReceivedEmployee = (req, res) => {
  const removed = employeeReceiveService.remove(req.params.ref);
  if (!removed) return res.status(404).json({ success: false, message: 'Employee not found' });
  res.json({ success: true, message: 'Employee removed from the received list' });
};

/**
 * Manually push approved employees to the device. Existing device users are skipped.
 */
export const pushApprovedToDevice = async (req, res) => {
  if (pushInProgress) {
    return res.status(409).json({ success: false, message: 'A device push is already in progress' });
  }
  const approved = employeeReceiveService.getApproved(refsFrom(req.body));
  if (approved.length === 0) {
    return res.status(400).json({ success: false, message: 'No approved employees to send' });
  }

  pushInProgress = true;
  try {
    const results = await zkService.addUsersIfMissing(
      approved.map(e => ({ key: e.id, deviceUserId: e.deviceUserId, name: e.name }))
    );
    employeeReceiveService.applyDeviceResults(results);
    const count = status => results.filter(r => r.status === status).length;
    const failed = count('failed');
    res.status(failed === results.length ? 502 : 200).json({
      success: failed < results.length,
      message: `${count('created')} added, ${count('exists')} already on device (unchanged), ${failed} failed`,
      results
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: `Failed to send employees to device at ${zkService.ip}:${zkService.port}`,
      error: errorText(error)
    });
  } finally {
    pushInProgress = false;
  }
};
