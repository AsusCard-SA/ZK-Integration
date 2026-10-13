import zkService from '../services/zkService.js';
import edaraService from '../services/edaraService.js';

/**
 * Get all configured Edara destination servers
 */
export const getEdaraServers = async (req, res) => {
  try {
    const servers = edaraService.getServers();
    res.status(200).json({
      success: true,
      count: servers.length,
      data: servers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve Edara servers',
      error: error.message || error
    });
  }
};

/**
 * Add a new Edara destination server
 */
export const addEdaraServer = async (req, res) => {
  try {
    const { name, url, apiKey, enabled } = req.body;
    const newServer = edaraService.addServer({ name, url, apiKey, enabled });
    res.status(201).json({
      success: true,
      message: `Server "${newServer.name}" added successfully`,
      data: newServer
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to add Edara server'
    });
  }
};

/**
 * Update an existing Edara destination server
 */
export const updateEdaraServer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, apiKey, enabled } = req.body;
    const updated = edaraService.updateServer(id, { name, url, apiKey, enabled });
    res.status(200).json({
      success: true,
      message: `Server "${updated.name}" updated successfully`,
      data: updated
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to update Edara server'
    });
  }
};

/**
 * Delete an Edara destination server
 */
export const deleteEdaraServer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = edaraService.deleteServer(id);
    res.status(200).json({
      success: true,
      message: 'Server removed successfully',
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete Edara server'
    });
  }
};

/**
 * Test connectivity and auth to an Edara server
 */
export const testEdaraServer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await edaraService.testServer(id);
    res.status(200).json({
      success: result.success,
      message: result.message,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || 'Failed to test server connectivity'
    });
  }
};

/**
 * Preview attendance records formatted for Edara HR API
 */
export const previewEdaraPayload = async (req, res) => {
  try {
    const { userId, startDate, endDate, limit } = req.query;
    const logs = await zkService.getAttendances();
    let filteredLogs = Array.isArray(logs) ? logs : [];

    if (userId) {
      filteredLogs = filteredLogs.filter(log => String(log.deviceUserId || log.userSn) === String(userId));
    }
    if (startDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.recordTime) >= new Date(startDate));
    }
    if (endDate) {
      filteredLogs = filteredLogs.filter(log => new Date(log.recordTime) <= new Date(`${endDate}T23:59:59`));
    }

    if (limit) {
      filteredLogs = filteredLogs.slice(0, parseInt(limit, 10));
    }

    const formattedRecords = edaraService.formatRecords(filteredLogs);
    const servers = edaraService.getServers();

    res.status(200).json({
      success: true,
      count: formattedRecords.length,
      targetServersCount: servers.filter(s => s.enabled).length,
      servers: servers,
      data: {
        records: formattedRecords
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to preview Edara HR payload',
      error: error.message || error
    });
  }
};

/**
 * Send attendance records to all defined (or selected) Edara HR servers
 */
export const syncToEdara = async (req, res) => {
  try {
    const { records, userId, startDate, endDate, serverId = 'all', apiKey, apiUrl } = req.body;
    let recordsToSend = records;

    // If records array was not provided directly in body, fetch from MB2000 device
    if (!recordsToSend || !Array.isArray(recordsToSend) || recordsToSend.length === 0) {
      const logs = await zkService.getAttendances();
      let filteredLogs = Array.isArray(logs) ? logs : [];

      if (userId) {
        filteredLogs = filteredLogs.filter(log => String(log.deviceUserId || log.userSn) === String(userId));
      }
      if (startDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.recordTime) >= new Date(startDate));
      }
      if (endDate) {
        filteredLogs = filteredLogs.filter(log => new Date(log.recordTime) <= new Date(`${endDate}T23:59:59`));
      }

      recordsToSend = edaraService.formatRecords(filteredLogs);
    }

    if (recordsToSend.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No attendance records found to synchronize.'
      });
    }

    const syncSummary = await edaraService.syncAttendanceRecordsToServers(recordsToSend, {
      serverId,
      customUrl: apiUrl,
      customApiKey: apiKey
    });

    const isAllSuccess = syncSummary.failCount === 0;
    const isPartial = syncSummary.successCount > 0 && syncSummary.failCount > 0;

    res.status(200).json({
      success: syncSummary.successCount > 0,
      partial: isPartial,
      allSuccess: isAllSuccess,
      message: isAllSuccess
        ? `Successfully synchronized ${recordsToSend.length} records to all ${syncSummary.totalServers} destination servers!`
        : `Synchronized ${recordsToSend.length} records to ${syncSummary.successCount} of ${syncSummary.totalServers} destination servers (${syncSummary.failCount} failed).`,
      syncedCount: recordsToSend.length,
      summary: syncSummary,
      serverResults: syncSummary.serverResults,
      edaraResponse: syncSummary.serverResults[0]?.response || null
    });
  } catch (error) {
    console.error('Edara Multi-Server Sync Error:', error);
    res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Failed to sync attendance records to Edara HR servers',
      error: error.data || error
    });
  }
};
