import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  CloudUpload, 
  CheckCircle2, 
  AlertTriangle, 
  Search, 
  Calendar, 
  Eye, 
  EyeOff,
  ShieldCheck, 
  Code2, 
  Clock, 
  Building2, 
  Lock,
  Server,
  Plus,
  Trash2,
  Edit3,
  RefreshCw,
  Power,
  Globe,
  Check,
  X
} from 'lucide-react';
import { 
  syncToEdaraHR, 
  fetchEdaraServers, 
  createEdaraServer, 
  updateEdaraServer, 
  deleteEdaraServer, 
  testEdaraServer 
} from '../services/api';
import { useTranslation } from '../context/LanguageContext';

export default function HRSyncPage({ users, attendances }) {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState('all');
  const [startDate, setStartDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState('');
  const [recordTypeDefault, setRecordTypeDefault] = useState('unknown');

  // Server management state
  const [servers, setServers] = useState([]);
  const [loadingServers, setLoadingServers] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [selectedTargetServer, setSelectedTargetServer] = useState('all');

  // Server form (Add / Edit)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingServerId, setEditingServerId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    apiKey: '',
    enabled: true
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Per-server testing state
  const [testingId, setTestingId] = useState(null);
  const [testResults, setTestResults] = useState({});
  const [visibleKeyIds, setVisibleKeyIds] = useState({});

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [activeView, setActiveView] = useState('table');

  // Load configured servers from backend
  const loadServers = async () => {
    try {
      setLoadingServers(true);
      const res = await fetchEdaraServers();
      if (res.success && Array.isArray(res.data)) {
        setServers(res.data);
      }
    } catch (err) {
      console.error('Failed to load Edara servers:', err);
    } finally {
      setLoadingServers(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const activeServers = useMemo(() => {
    return servers.filter(s => s.enabled);
  }, [servers]);

  const usersMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      map[String(u.userId)] = u.name || `${t('employee')} #${u.userId}`;
    });
    return map;
  }, [users, t]);

  const preparedRecords = useMemo(() => {
    return attendances
      .filter(log => {
        const uId = String(log.deviceUserId || log.userSn || '');
        const matchesUser = selectedUser === 'all' || uId === selectedUser;

        let matchesDate = true;
        if (startDate) {
          matchesDate = matchesDate && new Date(log.recordTime) >= new Date(startDate);
        }
        if (endDate) {
          matchesDate = matchesDate && new Date(log.recordTime) <= new Date(`${endDate}T23:59:59`);
        }

        return matchesUser && matchesDate;
      })
      .map(log => {
        const d = new Date(log.recordTime);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return {
          employee_code: String(log.deviceUserId || log.userSn || ''),
          date: `${year}-${month}-${day}`,
          time: `${hours}:${minutes}:${seconds}`,
          record_type: recordTypeDefault
        };
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [attendances, selectedUser, startDate, endDate, recordTypeDefault]);

  // Form Handlers
  const handleOpenAddForm = () => {
    setEditingServerId(null);
    setFormData({
      name: '',
      url: 'https://ysqqnkbgkrjoxrzlejxy.supabase.co/functions/v1/api-zk-attendance',
      apiKey: '',
      enabled: true
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleOpenEditForm = (server) => {
    setEditingServerId(server.id);
    setFormData({
      name: server.name || '',
      url: server.url || '',
      apiKey: server.apiKey || '',
      enabled: server.enabled !== undefined ? server.enabled : true
    });
    setFormError('');
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingServerId(null);
    setFormError('');
  };

  const handleSaveServer = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError(t('serverNameLabel') + ' is required');
      return;
    }
    if (!formData.url.trim()) {
      setFormError(t('endpointUrlLabel') + ' is required');
      return;
    }
    if (!formData.apiKey.trim()) {
      setFormError(t('apiKeyLabel') + ' is required');
      return;
    }

    setFormSaving(true);
    setFormError('');

    try {
      if (editingServerId) {
        await updateEdaraServer(editingServerId, formData);
      } else {
        await createEdaraServer(formData);
      }
      await loadServers();
      handleCloseForm();
    } catch (err) {
      setFormError(err.message || 'Failed to save server');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteServer = async (server) => {
    const confirmMsg = t('deleteServerConfirm').replace('{name}', server.name);
    if (!window.confirm(confirmMsg)) return;

    try {
      await deleteEdaraServer(server.id);
      await loadServers();
      if (selectedTargetServer === server.id) {
        setSelectedTargetServer('all');
      }
    } catch (err) {
      alert(err.message || 'Failed to delete server');
    }
  };

  const handleToggleEnabled = async (server) => {
    try {
      await updateEdaraServer(server.id, { enabled: !server.enabled });
      await loadServers();
    } catch (err) {
      alert(err.message || 'Failed to toggle server');
    }
  };

  const handleTestConnection = async (serverId) => {
    setTestingId(serverId);
    setTestResults(prev => ({ ...prev, [serverId]: null }));

    try {
      const res = await testEdaraServer(serverId);
      setTestResults(prev => ({
        ...prev,
        [serverId]: {
          success: res.success,
          message: res.message || (res.success ? 'Connected successfully' : 'Failed to connect')
        }
      }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [serverId]: {
          success: false,
          message: err.message || 'Connection failed'
        }
      }));
    } finally {
      setTestingId(null);
    }
  };

  const toggleKeyVisibility = (serverId) => {
    setVisibleKeyIds(prev => ({ ...prev, [serverId]: !prev[serverId] }));
  };

  // Dispatch attendance data to Edara
  const handleSendToEdara = async () => {
    if (preparedRecords.length === 0) {
      alert(t('noRecordsDateRange'));
      return;
    }

    const targetCount = selectedTargetServer === 'all' 
      ? activeServers.length 
      : 1;

    if (targetCount === 0) {
      alert(t('noServersDefined'));
      return;
    }

    const confirmMsg = selectedTargetServer === 'all'
      ? t('pushToAllServers').replace('{count}', preparedRecords.length).replace('{servers}', targetCount) + '?'
      : t('pushToEdara').replace('{count}', preparedRecords.length) + '?';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await syncToEdaraHR({
        records: preparedRecords,
        serverId: selectedTargetServer
      });

      setSyncResult({
        success: response.success,
        partial: response.partial,
        message: response.message || t('allServersSucceeded').replace('{count}', targetCount),
        details: response
      });
    } catch (error) {
      setSyncResult({
        success: false,
        message: error.message || 'Error syncing to Edara servers',
        details: error
      });
    } finally {
      setSyncing(false);
    }
  };

  const sendButtonText = useMemo(() => {
    if (syncing) return t('transmitting');
    if (selectedTargetServer === 'all') {
      return t('pushToAllServers')
        .replace('{count}', preparedRecords.length)
        .replace('{servers}', activeServers.length);
    }
    const s = servers.find(x => x.id === selectedTargetServer);
    return `Push ${preparedRecords.length} to ${s ? s.name : 'Server'}`;
  }, [syncing, selectedTargetServer, preparedRecords.length, activeServers.length, servers, t]);

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={24} color="#6366f1" />
            <h1 className="page-title">{t('edaraTitle')}</h1>
          </div>
          <p className="page-subtitle">{t('edaraSubtitle')}</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            className="btn btn-secondary"
            onClick={() => setShowConfig(!showConfig)}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Server size={15} color="#818cf8" />
            <span>{showConfig ? t('hideConfig') : t('apiCredentials')}</span>
            <span 
              className="badge" 
              style={{ 
                background: activeServers.length > 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                color: activeServers.length > 0 ? '#34d399' : '#fb7185',
                fontSize: '0.72rem',
                padding: '2px 6px'
              }}
            >
              {activeServers.length}/{servers.length}
            </span>
          </button>

          <button 
            className="btn btn-primary"
            onClick={handleSendToEdara}
            disabled={syncing || preparedRecords.length === 0 || activeServers.length === 0}
            style={{ 
              background: 'linear-gradient(135deg, #10b981, #059669)', 
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' 
            }}
          >
            <Send size={16} className={syncing ? 'spinner' : ''} />
            <span>{sendButtonText}</span>
          </button>
        </div>
      </div>

      {/* Automated Cron Schedule Banner */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
              <Clock size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff' }}>
                {t('autoCronActive')}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {t('autoCronDesc')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <span className="badge badge-punch" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              {t('schedule11AM')}
            </span>
            <span className="badge badge-punch" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
              {t('schedule08PM')}
            </span>
          </div>
        </div>
      </div>

      {/* Sync Result Banner */}
      {syncResult && (
        <div 
          style={{ 
            padding: 18, 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 20, 
            background: syncResult.success 
              ? (syncResult.partial ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)')
              : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${
              syncResult.success 
                ? (syncResult.partial ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.35)')
                : 'rgba(244, 63, 94, 0.35)'
            }`,
            color: syncResult.success 
              ? (syncResult.partial ? '#fbbf24' : '#34d399')
              : '#fb7185'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {syncResult.success && !syncResult.partial ? (
              <CheckCircle2 size={24} style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>{syncResult.message}</div>
              
              {/* Detailed Breakdown per Server */}
              {syncResult.details?.serverResults && syncResult.details.serverResults.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc', marginBottom: 8 }}>
                    {t('serverResultsTitle')} ({syncResult.details.serverResults.length}):
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
                    {syncResult.details.serverResults.map((sr, idx) => (
                      <div 
                        key={idx}
                        style={{
                          background: 'rgba(15, 23, 42, 0.65)',
                          border: `1px solid ${sr.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
                          borderRadius: 8,
                          padding: 12,
                          color: '#e2e8f0'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{sr.serverName}</span>
                          <span 
                            className="badge" 
                            style={{ 
                              background: sr.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                              color: sr.success ? '#34d399' : '#fb7185',
                              fontSize: '0.72rem'
                            }}
                          >
                            {sr.success ? `HTTP ${sr.status} OK` : `Error ${sr.status || ''}`}
                          </span>
                        </div>
                        <div className="mono" style={{ fontSize: '0.74rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {sr.url}
                        </div>
                        {sr.error && (
                          <div style={{ marginTop: 6, fontSize: '0.78rem', color: '#fb7185' }}>
                            {sr.error}
                          </div>
                        )}
                        {sr.response && (
                          <pre className="mono" style={{ marginTop: 8, fontSize: '0.72rem', background: 'rgba(0,0,0,0.4)', padding: 8, borderRadius: 4, overflowX: 'auto', maxHeight: 120 }}>
                            {JSON.stringify(sr.response, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SERVER-MANAGED CREDENTIALS & DESTINATIONS DRAWER */}
      {showConfig && (
        <div className="card animate-fade-in" style={{ marginBottom: 20, border: '1px solid rgba(99, 102, 241, 0.4)', background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldCheck size={22} color="#6366f1" />
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
                  {t('serverCredentialsTitle')}
                </h2>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                  {t('serverCredentialsSubtitle')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="badge badge-punch" style={{ fontSize: '0.78rem', padding: '5px 10px' }}>
                {t('activeServersCount').replace('{active', activeServers.length).replace('{total}', servers.length)}
              </span>

              <button 
                className="btn btn-primary"
                onClick={handleOpenAddForm}
                style={{ padding: '7px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={15} />
                <span>{t('addServerBtn')}</span>
              </button>
            </div>
          </div>

          {/* ADD / EDIT SERVER FORM */}
          {isFormOpen && (
            <form 
              onSubmit={handleSaveServer}
              className="card"
              style={{
                marginBottom: 16,
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(99, 102, 241, 0.5)',
                padding: 16
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {editingServerId ? <Edit3 size={15} /> : <Plus size={15} />}
                  {editingServerId ? t('editServer') : t('addServerBtn')}
                </span>
                <button type="button" onClick={handleCloseForm} className="btn btn-secondary" style={{ padding: '4px 8px' }}>
                  <X size={14} />
                </button>
              </div>

              {formError && (
                <div style={{ padding: '8px 12px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', borderRadius: 6, color: '#fb7185', fontSize: '0.8rem', marginBottom: 12 }}>
                  {formError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    {t('serverNameLabel')} *
                  </label>
                  <input 
                    type="text"
                    className="input"
                    placeholder={t('serverNamePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    required
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    {t('endpointUrlLabel')} *
                  </label>
                  <input 
                    type="url"
                    className="input mono"
                    placeholder={t('endpointUrlPlaceholder')}
                    value={formData.url}
                    onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>
                    {t('apiKeyLabel')} *
                  </label>
                  <input 
                    type="text"
                    className="input mono"
                    placeholder={t('apiKeyPlaceholder')}
                    value={formData.apiKey}
                    onChange={(e) => setFormData(prev => ({ ...prev, apiKey: e.target.value }))}
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                    {t('serverStatus')}
                  </label>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
                    />
                    <span>{formData.enabled ? t('serverEnabled') : t('serverDisabled')}</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={handleCloseForm} disabled={formSaving}>
                  {t('cancelBtn')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={formSaving}>
                  {formSaving ? t('savingServer') : t('saveServer')}
                </button>
              </div>
            </form>
          )}

          {/* SERVERS LIST */}
          {servers.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <Server size={32} color="#6366f1" />
              <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                {t('noServersDefined')}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {servers.map((server) => {
                const isTesting = testingId === server.id;
                const testResult = testResults[server.id];
                const isKeyVisible = visibleKeyIds[server.id];

                return (
                  <div 
                    key={server.id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.55)',
                      border: `1px solid ${server.enabled ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: 10,
                      padding: '14px 16px',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      opacity: server.enabled ? 1 : 0.65
                    }}
                  >
                    {/* Server Info */}
                    <div style={{ flex: 1, minWidth: 260 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f8fafc' }}>
                          {server.name}
                        </span>
                        <span 
                          className="badge" 
                          style={{ 
                            background: server.enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: server.enabled ? '#34d399' : '#fb7185',
                            fontSize: '0.72rem',
                            padding: '2px 8px'
                          }}
                        >
                          {server.enabled ? t('serverEnabled') : t('serverDisabled')}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                          <Globe size={13} color="#06b6d4" />
                          <span className="mono" style={{ color: '#38bdf8' }}>{server.url}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Lock size={12} color="#f59e0b" />
                          <span className="mono" style={{ color: 'var(--text-muted)' }}>
                            {isKeyVisible ? server.apiKey : (server.apiKey ? server.apiKey.slice(0, 8) + '••••••••' : 'None')}
                          </span>
                          <button 
                            type="button" 
                            onClick={() => toggleKeyVisibility(server.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'inline-flex' }}
                          >
                            {isKeyVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                          </button>
                        </div>
                      </div>

                      {/* Connection Test Result Feedback */}
                      {testResult && (
                        <div 
                          style={{ 
                            marginTop: 8, 
                            fontSize: '0.76rem', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: 6,
                            padding: '3px 8px',
                            borderRadius: 4,
                            background: testResult.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
                            color: testResult.success ? '#34d399' : '#fb7185'
                          }}
                        >
                          {testResult.success ? <Check size={12} /> : <X size={12} />}
                          <span>{testResult.message}</span>
                        </div>
                      )}
                    </div>

                    {/* Server Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleTestConnection(server.id)}
                        disabled={isTesting}
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        title={t('testConnectionBtn')}
                      >
                        <RefreshCw size={13} className={isTesting ? 'spinner' : ''} />
                        <span>{isTesting ? t('testing') : t('testConnectionBtn')}</span>
                      </button>

                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleToggleEnabled(server)}
                        style={{ 
                          padding: '6px 10px', 
                          fontSize: '0.78rem',
                          color: server.enabled ? '#fb7185' : '#34d399'
                        }}
                        title={t('toggleActive')}
                      >
                        <Power size={13} />
                      </button>

                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleOpenEditForm(server)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem' }}
                        title={t('editServer')}
                      >
                        <Edit3 size={13} />
                      </button>

                      <button 
                        className="btn btn-secondary"
                        onClick={() => handleDeleteServer(server)}
                        style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#fb7185' }}
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter & Preparation Toolbar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} color="#6366f1" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('from')}</span>
              <input 
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('to')}</span>
              <input 
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <select 
              className="input"
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="all">{t('allStaff')} ({Object.keys(usersMap).length})</option>
              {Object.entries(usersMap).map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({t('userId')}: {id})
                </option>
              ))}
            </select>

            <select 
              className="input"
              value={recordTypeDefault}
              onChange={(e) => setRecordTypeDefault(e.target.value)}
            >
              <option value="unknown">{t('typeUnknown')}</option>
              <option value="entry">{t('typeEntry')}</option>
              <option value="exit">{t('typeExit')}</option>
            </select>

            {/* Target Server Destination Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Server size={15} color="#818cf8" />
              <select
                className="input mono"
                value={selectedTargetServer}
                onChange={(e) => setSelectedTargetServer(e.target.value)}
                style={{ fontSize: '0.82rem', maxWidth: 200 }}
              >
                <option value="all">
                  🌐 {t('allActiveServers')} ({activeServers.length})
                </option>
                {servers.map(s => (
                  <option key={s.id} value={s.id} disabled={!s.enabled}>
                    {s.name} {!s.enabled ? `(${t('serverDisabled')})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {(startDate || endDate) && (
              <button className="btn btn-secondary" onClick={() => { setStartDate(''); setEndDate(''); }}>
                {t('clearDates')}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className={`btn ${activeView === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('table')}
            >
              <Eye size={15} />
              <span>{t('gridView')}</span>
            </button>

            <button 
              className={`btn ${activeView === 'json' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActiveView('json')}
            >
              <Code2 size={15} />
              <span>{t('jsonPayload')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payload Preview */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CloudUpload size={18} color="#10b981" />
            <span>{t('preparedBatch').replace('{count}', preparedRecords.length)}</span>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
            {t('specNote')}
          </div>
        </div>

        {preparedRecords.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={40} color="#f59e0b" />
            <h3>{t('noRecordsDateRange')}</h3>
            <p>{t('noRecordsDateDesc')}</p>
          </div>
        ) : activeView === 'table' ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>employee_code</th>
                  <th>{t('employeeName')}</th>
                  <th>{t('punchDate')} (YYYY-MM-DD)</th>
                  <th>{t('punchTime')} (HH:MM:SS)</th>
                  <th>record_type</th>
                  <th>{t('status')}</th>
                </tr>
              </thead>
              <tbody>
                {preparedRecords.map((r, idx) => {
                  const employeeName = usersMap[r.employee_code] || 'Unassigned';
                  return (
                    <tr key={idx}>
                      <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{idx + 1}</td>
                      <td>
                        <span className="badge badge-punch mono">
                          {r.employee_code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{employeeName}</td>
                      <td className="mono" style={{ color: 'var(--text-secondary)' }}>{r.date}</td>
                      <td className="mono" style={{ color: '#22d3ee', fontWeight: 600 }}>{r.time}</td>
                      <td>
                        <span className="badge badge-user mono">
                          {r.record_type}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.78rem', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={13} /> {t('edaraReady')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <pre 
            className="mono" 
            style={{ 
              background: 'rgba(15, 23, 42, 0.85)', 
              padding: 18, 
              borderRadius: 'var(--radius-md)', 
              fontSize: '0.82rem', 
              color: '#38bdf8', 
              maxHeight: 500, 
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)'
            }}
          >
            {JSON.stringify({ records: preparedRecords }, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
