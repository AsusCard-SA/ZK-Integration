import express from 'express';
import {
  requireReceiveAuth,
  receiveEmployees,
  receiveHealth,
  getApiSettings,
  updateApiSettings,
  generateApiToken,
  getReceivedEmployees,
  approveEmployees,
  setEmployeeDeviceUserId,
  deleteReceivedEmployee,
  pushApprovedToDevice
} from '../controllers/employeeController.js';

const router = express.Router();

// External: ZK Central pushes employees here (Bearer token)
router.post('/receive', requireReceiveAuth, receiveEmployees);
router.get('/receive/health', requireReceiveAuth, receiveHealth);

// API Settings page
router.get('/settings', getApiSettings);
router.put('/settings', updateApiSettings);
router.post('/settings/token', generateApiToken);

// Received employees & manual device sync
router.get('/received', getReceivedEmployees);
router.post('/received/approve', approveEmployees);
router.put('/received/:ref/device-user-id', setEmployeeDeviceUserId);
router.delete('/received/:ref', deleteReceivedEmployee);
router.post('/received/push-to-device', pushApprovedToDevice);

export default router;
