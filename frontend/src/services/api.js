const API_BASE = '/api/zk';

export async function fetchDeviceStatus() {
  const res = await fetch(`${API_BASE}/status`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Device offline or unreachable' }));
    throw new Error(err.message || 'Failed to fetch device status');
  }
  return await res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch users' }));
    throw new Error(err.message || 'Failed to fetch users');
  }
  return await res.json();
}

export async function fetchAttendances({ userId = '', startDate = '', endDate = '' } = {}) {
  const params = new URLSearchParams();
  if (userId) params.append('userId', userId);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const url = `${API_BASE}/attendances${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch attendances' }));
    throw new Error(err.message || 'Failed to fetch attendances');
  }
  return await res.json();
}

export async function clearAttendanceLogs() {
  const res = await fetch(`${API_BASE}/clear-logs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true })
  });
  return await res.json();
}

export async function enableDevice() {
  const res = await fetch(`${API_BASE}/enable`, { method: 'POST' });
  return await res.json();
}

export async function disableDevice() {
  const res = await fetch(`${API_BASE}/disable`, { method: 'POST' });
  return await res.json();
}

export async function syncDeviceTime(time = new Date()) {
  const res = await fetch(`${API_BASE}/sync-time`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ time })
  });
  return await res.json();
}

export async function restartDevice() {
  const res = await fetch(`${API_BASE}/restart`, { method: 'POST' });
  return await res.json();
}

export async function fetchEdaraServers() {
  const res = await fetch(`${API_BASE}/edara/servers`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to fetch Edara servers' }));
    throw new Error(err.message || 'Failed to fetch Edara servers');
  }
  return await res.json();
}

export async function createEdaraServer(serverData) {
  const res = await fetch(`${API_BASE}/edara/servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to create Edara server');
  }
  return data;
}

export async function updateEdaraServer(id, serverData) {
  const res = await fetch(`${API_BASE}/edara/servers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverData)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to update Edara server');
  }
  return data;
}

export async function deleteEdaraServer(id) {
  const res = await fetch(`${API_BASE}/edara/servers/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to delete Edara server');
  }
  return data;
}

export async function testEdaraServer(id) {
  const res = await fetch(`${API_BASE}/edara/servers/${id}/test`, {
    method: 'POST'
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || 'Failed to test server connectivity');
  }
  return data;
}

export async function previewEdaraSync(params = {}) {
  const q = new URLSearchParams();
  if (params.userId) q.append('userId', params.userId);
  if (params.startDate) q.append('startDate', params.startDate);
  if (params.endDate) q.append('endDate', params.endDate);
  if (params.limit) q.append('limit', params.limit);

  const res = await fetch(`${API_BASE}/edara/preview${q.toString() ? '?' + q.toString() : ''}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Failed to preview Edara payload' }));
    throw new Error(err.message || 'Failed to preview Edara payload');
  }
  return await res.json();
}

export async function syncToEdaraHR(options = {}) {
  const res = await fetch(`${API_BASE}/edara/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Edara sync failed with status ${res.status}`);
  }
  return data;
}

export async function getEdaraSchedulerStatus() {
  const res = await fetch(`${API_BASE}/edara/scheduler-status`);
  if (!res.ok) return { success: false };
  return await res.json();
}

export async function triggerEdaraScheduleNow() {
  const res = await fetch(`${API_BASE}/edara/scheduler-trigger`, { method: 'POST' });
  return await res.json();
}

export async function executeDeviceCommand(commandId, data = '') {
  const res = await fetch(`${API_BASE}/execute-command`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ commandId, data })
  });
  return await res.json();
}
