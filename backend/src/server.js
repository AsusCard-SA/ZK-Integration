import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import zkRoutes from './routes/zkRoutes.js';
import employeeRoutes from './routes/employeeRoutes.js';
import schedulerService from './services/schedulerService.js';
import { deviceConfig } from './config/deviceConfig.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API Routes
app.use('/api/zk', zkRoutes);
app.use('/api/employees', employeeRoutes);

// Serve Frontend Static Production Assets
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API Info Endpoint
app.get('/api', (req, res) => {
  res.json({
    name: `ZKTeco ${deviceConfig.model} Integration API`,
    version: '1.0.0',
    deviceTarget: `${deviceConfig.ip}:${deviceConfig.port}`,
    scheduler: schedulerService.getSchedulerStatus(),
    endpoints: {
      status: 'GET /api/zk/status',
      users: 'GET /api/zk/users',
      attendances: 'GET /api/zk/attendances?userId=&startDate=&endDate=',
      edaraPreview: 'GET /api/zk/edara/preview',
      edaraSync: 'POST /api/zk/edara/sync',
      edaraSchedulerStatus: 'GET /api/zk/edara/scheduler-status',
      clearLogs: 'POST /api/zk/clear-logs',
      enable: 'POST /api/zk/enable',
      disable: 'POST /api/zk/disable',
      executeCommand: 'POST /api/zk/execute-command',
      employeesReceive: 'POST /api/employees/receive (Bearer token)',
      employeesReceiveHealth: 'GET /api/employees/receive/health (Bearer token)'
    }
  });
});

app.get('/api/zk/config', (req, res) => res.json({ success: true, data: deviceConfig }));

// Single Page Application (SPA) Fallback for Frontend Routing
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  // Client errors such as malformed JSON keep their 4xx status
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`🚀 ZKTeco ${deviceConfig.model} API Server running`);
  console.log(`📡 Local URL: http://localhost:${PORT}`);
  console.log(`📟 Target Device: ${deviceConfig.ip}:${deviceConfig.port}`);
  console.log(`=========================================`);

  // Start automated cron jobs (11:00 AM and 08:00 PM)
  schedulerService.initScheduler();
});
