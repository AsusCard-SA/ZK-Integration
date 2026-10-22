import dotenv from 'dotenv';

dotenv.config();

export function getDeviceConfig(env = process.env) {
  const port = Number.parseInt(env.ZK_PORT || '4370', 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('ZK_PORT must be a number between 1 and 65535');
  }

  return {
    model: env.ZK_MODEL || 'MB2000',
    ip: env.ZK_IP || '192.168.1.147',
    port,
    timezone: env.ZK_TIMEZONE || null
  };
}

export const deviceConfig = getDeviceConfig();
