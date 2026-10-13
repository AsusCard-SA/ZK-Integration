import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SERVERS_FILE = path.join(DATA_DIR, 'edaraServers.json');

class EdaraService {
  constructor() {
    this.apiUrl = process.env.EDARA_API_URL || 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/api-zk-attendance';
    this.apiKey = process.env.EDARA_API_KEY || 'ek_fgo0f5l1ah4vzda6mbxgezhwu90iznmm';
    this.ensureStorage();
  }

  /**
   * Ensure data directory and servers file exist
   */
  ensureStorage() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (!fs.existsSync(SERVERS_FILE)) {
        const initialServers = [
          {
            id: 'srv_primary',
            name: 'Primary Edara HR Cloud',
            url: this.apiUrl,
            apiKey: this.apiKey,
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ];
        fs.writeFileSync(SERVERS_FILE, JSON.stringify(initialServers, null, 2), 'utf-8');
      }
    } catch (error) {
      console.error('Error initializing Edara servers storage:', error);
    }
  }

  /**
   * Read all configured Edara servers from storage
   */
  getServers() {
    this.ensureStorage();
    try {
      const data = fs.readFileSync(SERVERS_FILE, 'utf-8');
      const servers = JSON.parse(data);
      return Array.isArray(servers) ? servers : [];
    } catch (error) {
      console.error('Error reading Edara servers:', error);
      return [];
    }
  }

  /**
   * Save servers list to disk
   */
  saveServers(servers) {
    this.ensureStorage();
    try {
      fs.writeFileSync(SERVERS_FILE, JSON.stringify(servers, null, 2), 'utf-8');
      return true;
    } catch (error) {
      console.error('Error writing Edara servers:', error);
      throw new Error('Failed to persist Edara servers');
    }
  }

  /**
   * Add a new destination server
   */
  addServer({ name, url, apiKey, enabled = true }) {
    if (!name || !name.trim()) throw new Error('Server name is required');
    if (!url || !url.trim()) throw new Error('Endpoint URL is required');
    if (!apiKey || !apiKey.trim()) throw new Error('API Key is required');

    const servers = this.getServers();
    const newServer = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim(),
      url: url.trim(),
      apiKey: apiKey.trim(),
      enabled: Boolean(enabled),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    servers.push(newServer);
    this.saveServers(servers);
    return newServer;
  }

  /**
   * Update an existing destination server
   */
  updateServer(id, updateData) {
    const servers = this.getServers();
    const index = servers.findIndex(s => s.id === id);
    if (index === -1) {
      throw new Error(`Server with id "${id}" not found`);
    }

    const current = servers[index];
    const updated = {
      ...current,
      name: updateData.name !== undefined ? updateData.name.trim() : current.name,
      url: updateData.url !== undefined ? updateData.url.trim() : current.url,
      apiKey: updateData.apiKey !== undefined ? updateData.apiKey.trim() : current.apiKey,
      enabled: updateData.enabled !== undefined ? Boolean(updateData.enabled) : current.enabled,
      updatedAt: new Date().toISOString()
    };

    servers[index] = updated;
    this.saveServers(servers);
    return updated;
  }

  /**
   * Delete an existing server
   */
  deleteServer(id) {
    const servers = this.getServers();
    const filtered = servers.filter(s => s.id !== id);
    if (filtered.length === servers.length) {
      throw new Error(`Server with id "${id}" not found`);
    }
    this.saveServers(filtered);
    return { success: true, id };
  }

  /**
   * Test connection to a specific server
   */
  async testServer(serverOrId) {
    let server = null;
    if (typeof serverOrId === 'string') {
      const servers = this.getServers();
      server = servers.find(s => s.id === serverOrId);
      if (!server) throw new Error(`Server with ID "${serverOrId}" not found`);
    } else {
      server = serverOrId;
    }

    if (!server?.url || !server?.apiKey) {
      throw new Error('Invalid server credentials');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(server.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': server.apiKey,
          'x-api-key': server.apiKey
        },
        body: JSON.stringify({ records: [] }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      const responseData = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        message: response.ok 
          ? `Connected successfully (HTTP ${response.status})` 
          : (responseData.message || responseData.error || `HTTP ${response.status} ${response.statusText}`)
      };
    } catch (error) {
      clearTimeout(timeout);
      return {
        success: false,
        status: 0,
        statusText: 'Network Error',
        error: error.name === 'AbortError' ? 'Connection timed out (10s)' : (error.message || 'Network error'),
        message: error.name === 'AbortError' ? 'Connection timed out (10s)' : (error.message || 'Network error')
      };
    }
  }

  /**
   * Format ZKTeco logs into Edara HR Attendance payload
   */
  formatRecords(logs, usersMap = {}) {
    return logs.map((log) => {
      const d = new Date(log.recordTime);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');

      const dateStr = `${year}-${month}-${day}`;
      const timeStr = `${hours}:${minutes}:${seconds}`;
      const employeeCode = String(log.deviceUserId || log.userSn || '');

      return {
        employee_code: employeeCode,
        date: dateStr,
        time: timeStr,
        record_type: log.record_type || 'unknown'
      };
    });
  }

  /**
   * Sync attendance records to ALL defined (or selected) servers
   */
  async syncAttendanceRecordsToServers(records, { serverId = 'all', customUrl = null, customApiKey = null } = {}) {
    let targetServers = [];

    if (customUrl && customApiKey) {
      targetServers = [
        {
          id: 'custom_adhoc',
          name: 'Direct Endpoint',
          url: customUrl,
          apiKey: customApiKey,
          enabled: true
        }
      ];
    } else {
      const allServers = this.getServers();
      if (serverId && serverId !== 'all') {
        const found = allServers.find(s => s.id === serverId);
        if (!found) {
          throw new Error(`Target server "${serverId}" not found`);
        }
        targetServers = [found];
      } else {
        targetServers = allServers.filter(s => s.enabled);
      }
    }

    if (targetServers.length === 0) {
      throw new Error('No active destination servers defined to receive data. Please add or enable at least one server.');
    }

    const payload = { records };

    // Dispatch in parallel to all target servers
    const results = await Promise.allSettled(
      targetServers.map(async (server) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000);

        try {
          const response = await fetch(server.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': server.apiKey,
              'x-api-key': server.apiKey
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(timeout);

          const responseData = await response.json().catch(() => ({}));

          if (!response.ok) {
            return {
              serverId: server.id,
              serverName: server.name,
              url: server.url,
              success: false,
              status: response.status,
              statusText: response.statusText,
              error: responseData.message || responseData.error || `HTTP ${response.status} ${response.statusText}`,
              data: responseData
            };
          }

          return {
            serverId: server.id,
            serverName: server.name,
            url: server.url,
            success: true,
            status: response.status,
            statusText: response.statusText,
            response: responseData
          };
        } catch (err) {
          clearTimeout(timeout);
          return {
            serverId: server.id,
            serverName: server.name,
            url: server.url,
            success: false,
            status: 0,
            error: err.name === 'AbortError' ? 'Request timed out after 20s' : (err.message || 'Network error'),
            data: null
          };
        }
      })
    );

    const serverResults = results.map(r => r.status === 'fulfilled' ? r.value : {
      success: false,
      status: 0,
      error: r.reason?.message || 'Execution error'
    });

    const successCount = serverResults.filter(r => r.success).length;
    const failCount = serverResults.length - successCount;

    return {
      totalServers: targetServers.length,
      successCount,
      failCount,
      serverResults
    };
  }

  /**
   * Backwards-compatible sync method
   */
  async syncAttendanceRecords(records, customApiKey = null, customUrl = null) {
    if (customUrl || customApiKey) {
      const res = await this.syncAttendanceRecordsToServers(records, {
        customUrl: customUrl || this.apiUrl,
        customApiKey: customApiKey || this.apiKey
      });
      if (res.successCount === 0) {
        throw new Error(res.serverResults[0]?.error || 'Failed to sync with custom server');
      }
      return res.serverResults[0]?.response || res;
    }

    return await this.syncAttendanceRecordsToServers(records, { serverId: 'all' });
  }
}

export const edaraService = new EdaraService();
export default edaraService;
