import zkService from '../services/zkService.js';
import { deviceConfig } from '../config/deviceConfig.js';
import { deviceDateKey } from '../utils/deviceDate.js';
import employeeReceiveService from '../services/employeeReceiveService.js';

export const getStatus = async (req, res, next) => {
  try {
    const info = await zkService.getDeviceInfo();
    res.status(200).json({
      success: true,
      message: `Connected to ZKTeco ${deviceConfig.model} successfully`,
      data: info
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: `Failed to connect to ZKTeco device at ${zkService.ip}:${zkService.port}`,
      error: error.message || error
    });
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const users = await zkService.getUsers();
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users from device',
      error: error.message || error
    });
  }
};

export const getAttendances = async (req, res, next) => {
  try {
    const logs = await zkService.getAttendances();
    const { userId, startDate, endDate } = req.query;

    let filteredLogs = Array.isArray(logs) ? logs : [];

    if (userId) {
      filteredLogs = filteredLogs.filter(log => String(log.deviceUserId || log.userSn || log.userId) === String(userId));
    }

    if (startDate) {
      filteredLogs = filteredLogs.filter(log => deviceDateKey(log.recordTime, deviceConfig.timezone) >= startDate);
    }

    if (endDate) {
      filteredLogs = filteredLogs.filter(log => deviceDateKey(log.recordTime, deviceConfig.timezone) <= endDate);
    }

    res.status(200).json({
      success: true,
      totalDeviceLogs: Array.isArray(logs) ? logs.length : 0,
      count: filteredLogs.length,
      data: filteredLogs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch attendance logs from device',
      error: error.message || error
    });
  }
};


export const clearLogs = async (req, res, next) => {
  try {
    const { confirm } = req.body;
    if (confirm !== true && confirm !== 'true') {
      return res.status(400).json({
        success: false,
        message: 'Explicit confirmation required. Send { "confirm": true } in request body.'
      });
    }

    const result = await zkService.clearAttendanceLogs();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to clear attendance logs from device',
      error: error.message || error
    });
  }
};

export const disableDevice = async (req, res, next) => {
  try {
    const result = await zkService.disableDevice();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to disable device',
      error: error.message || error
    });
  }
};

export const enableDevice = async (req, res, next) => {
  try {
    const result = await zkService.enableDevice();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to enable device',
      error: error.message || error
    });
  }
};

export const syncTime = async (req, res, next) => {
  try {
    const customTime = req.body.time ? new Date(req.body.time) : new Date();
    const result = await zkService.setTime(customTime);
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to synchronize device time',
      error: error.message || error
    });
  }
};

export const restartDevice = async (req, res, next) => {
  try {
    const result = await zkService.restartDevice();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to restart device',
      error: error.message || error
    });
  }
};

export const executeCommand = async (req, res, next) => {
  try {
    const { commandId, data } = req.body;
    if (commandId === undefined) {
      return res.status(400).json({
        success: false,
        message: 'commandId is required in request body (e.g. 1004 for restart, 31 for unlock)'
      });
    }
    const result = await zkService.executeCustomCommand(Number(commandId), data || '');
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to execute command on device',
      error: error.message || error
    });
  }
};

// node-zklib rejects with ZKError objects, which carry no .message of their own
function deviceErrorText(error) {
  if (typeof error?.toast === 'function') return error.toast();
  return error?.message || String(error);
}

function parseUid(value) {
  const uid = Number(value);
  return Number.isInteger(uid) && uid > 0 && uid <= 65535 ? uid : null;
}

export const renameDeviceUser = async (req, res, next) => {
  const uid = parseUid(req.params.uid);
  const userId = req.body?.userId;
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  if (!uid || userId === undefined || userId === null || userId === '') {
    return res.status(400).json({ success: false, message: 'uid (path) and userId (body) are required' });
  }
  if (!name) {
    return res.status(400).json({ success: false, message: 'name is required' });
  }
  try {
    const data = await zkService.renameUser(uid, String(userId), name);
    res.status(200).json({ success: true, message: `User ${data.userId} renamed`, data });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Failed to rename user on device',
      error: deviceErrorText(error)
    });
  }
};

export const deleteDeviceUser = async (req, res, next) => {
  const uid = parseUid(req.params.uid);
  const userId = req.query.userId;
  if (!uid || !userId) {
    return res.status(400).json({ success: false, message: 'uid (path) and userId (query) are required' });
  }
  try {
    const data = await zkService.deleteUser(uid, String(userId));
    const unlocked = employeeReceiveService.markRemovedFromDevice(data.userId);
    res.status(200).json({ success: true, message: `User ${data.userId} deleted from device`, data, receivedEmployeesUnlocked: unlocked });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      success: false,
      message: 'Failed to delete user from device',
      error: deviceErrorText(error)
    });
  }
};
