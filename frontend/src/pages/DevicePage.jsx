import React, { useState } from 'react';
import { 
  Cpu, 
  RefreshCw, 
  Clock, 
  Lock, 
  Unlock, 
  RotateCcw, 
  Trash2, 
  CheckCircle, 
  AlertTriangle, 
  Terminal,
  Radio,
  HardDrive
} from 'lucide-react';
import { 
  enableDevice, 
  disableDevice, 
  clearAttendanceLogs, 
  syncDeviceTime, 
  restartDevice, 
  executeDeviceCommand 
} from '../services/api';
import { useTranslation } from '../context/LanguageContext';

export default function DevicePage({ statusData, deviceConfig, onRefresh }) {
  const { t } = useTranslation();
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [customCmd, setCustomCmd] = useState('');

  const isOnline = statusData?.success && statusData?.data?.status === 'online';
  const info = statusData?.data?.deviceInfo || {};
  const targetIp = deviceConfig?.ip || statusData?.data?.ip || '—';
  const targetPort = deviceConfig?.port || statusData?.data?.port || '—';

  const handleAction = async (actionName, apiFn) => {
    try {
      setActionLoading(true);
      setFeedback(null);
      const res = await apiFn();
      setFeedback({ success: true, message: res.message || `${actionName} executed successfully` });
      if (onRefresh) onRefresh();
    } catch (err) {
      setFeedback({ success: false, message: err.message || `${actionName} failed` });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSyncTime = () => {
    handleAction(t('syncClock'), () => syncDeviceTime(new Date()));
  };

  const handleRestart = () => {
    if (window.confirm(`Send RESTART command to ZKTeco ${deviceConfig?.model || 'device'} terminal? The device will reboot.`)) {
      handleAction(t('rebootTitle'), restartDevice);
    }
  };

  const handleClearLogs = () => {
    if (window.confirm('DANGER: Clear all attendance logs on the device? Please ensure you have exported or synced existing data first.')) {
      handleAction(t('purgeTitle'), clearAttendanceLogs);
    }
  };

  const handleRunCustomCmd = (e) => {
    e.preventDefault();
    if (!customCmd) return;
    handleAction(`Raw Command #${customCmd}`, () => executeDeviceCommand(parseInt(customCmd, 10)));
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('devTitle')}</h1>
          <p className="page-subtitle">{t('devSubtitle')}</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={onRefresh} disabled={actionLoading}>
            <RefreshCw size={16} className={actionLoading ? 'spinner' : ''} />
            <span>{t('testConnection')}</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div 
          style={{ 
            padding: 16, 
            borderRadius: 'var(--radius-md)', 
            marginBottom: 20, 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12,
            background: feedback.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${feedback.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            color: feedback.success ? '#34d399' : '#fb7185'
          }}
        >
          {feedback.success ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{feedback.message}</span>
        </div>
      )}

      {/* Hardware Specs Banner */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Cpu size={22} color="#6366f1" />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>{t('hardwareTitle')}</h2>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: 12 }}>
              <span>{t('target')}: <strong className="mono" style={{ color: 'var(--text-primary)' }}>{targetIp}:{targetPort}</strong></span>
              <span>•</span>
              <span>{t('protocol')}: <strong style={{ color: '#06b6d4' }}>TCP / ZKLib Protocol v2</strong></span>
            </div>
          </div>

          <div className={`status-pill ${isOnline ? 'online' : 'offline'}`} style={{ padding: '8px 18px', fontSize: '0.9rem' }}>
            <span className="beacon-dot" />
            <span>{isOnline ? t('activeConnection') : t('deviceOffline')}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>{t('enrolledStaff')}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>{info.userCounts ?? '--'} {t('usersCount')}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>{t('bufferLogsStored')}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: '#38bdf8' }}>{info.logCounts ?? '--'} {t('punchesCount')}</div>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 700 }}>{t('maxMemoryCap')}</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4, color: '#f59e0b' }}>{(info.logCapacity ?? 100000).toLocaleString()} {t('logsCap')}</div>
          </div>
        </div>
      </div>

      {/* Control Actions Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* Sync Time */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Clock size={20} color="#06b6d4" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('syncClock')}</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
            {t('syncClockDesc')}
          </p>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            disabled={actionLoading}
            onClick={handleSyncTime}
          >
            {t('syncDeviceTimeBtn')}
          </button>
        </div>

        {/* Lock Terminal */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Lock size={20} color="#f59e0b" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('terminalAccess')}</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
            {t('terminalAccessDesc')}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              disabled={actionLoading}
              onClick={() => handleAction('Enable Device', enableDevice)}
            >
              <Unlock size={14} /> {t('enableBtn')}
            </button>
            <button 
              className="btn btn-secondary" 
              style={{ flex: 1 }}
              disabled={actionLoading}
              onClick={() => handleAction('Disable Device', disableDevice)}
            >
              <Lock size={14} /> {t('disableBtn')}
            </button>
          </div>
        </div>

        {/* Reboot Terminal */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <RotateCcw size={20} color="#818cf8" />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('rebootTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
            {t('rebootDesc')}
          </p>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%' }}
            disabled={actionLoading}
            onClick={handleRestart}
          >
            {t('restartBtn')}
          </button>
        </div>

        {/* Clear Logs */}
        <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, color: '#fb7185' }}>
            <Trash2 size={20} />
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('purgeTitle')}</h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>
            {t('purgeDesc')}
          </p>
          <button 
            className="btn btn-secondary" 
            style={{ width: '100%', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fb7185' }}
            disabled={actionLoading}
            onClick={handleClearLogs}
          >
            {t('clearBtn')}
          </button>
        </div>
      </div>

      {/* Raw Protocol Terminal */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 700 }}>
          <Terminal size={17} /> {t('protocolTitle')}
        </div>
        
        <form onSubmit={handleRunCustomCmd} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <input
            type="number"
            className="input mono"
            placeholder={t('cmdPlaceholder')}
            value={customCmd}
            onChange={(e) => setCustomCmd(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={actionLoading || !customCmd}>
            {t('sendCommand')}
          </button>
        </form>

        <pre className="mono" style={{ background: 'rgba(15, 23, 42, 0.7)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: '0.82rem', color: '#38bdf8', overflowX: 'auto', margin: 0, border: '1px solid var(--border-subtle)' }}>
          {JSON.stringify(statusData || { status: 'Awaiting connection...' }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
