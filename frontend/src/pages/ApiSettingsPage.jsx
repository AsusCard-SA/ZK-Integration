import React, { useState, useEffect, useMemo } from 'react';
import {
  KeyRound,
  Link2,
  Copy,
  Check,
  Power,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Info,
  Trash2,
  UserCheck,
  Fingerprint,
  Users,
  Edit3,
  Lock
} from 'lucide-react';
import {
  fetchEmployeeApiSettings,
  setEmployeeApiEnabled,
  generateEmployeeApiToken,
  fetchReceivedEmployees,
  approveReceivedEmployees,
  setReceivedEmployeeDeviceId,
  deleteReceivedEmployee,
  pushApprovedEmployeesToDevice
} from '../services/api';
import { useTranslation } from '../context/LanguageContext';

const STATUS_STYLES = {
  pending: { key: 'statusPending', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
  approved: { key: 'statusApproved', bg: 'rgba(99, 102, 241, 0.18)', color: '#a5b4fc' },
  synced: { key: 'statusSynced', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  on_device: { key: 'statusOnDevice', bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' },
  failed: { key: 'statusFailed', bg: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }
};

const ON_DEVICE = new Set(['synced', 'on_device']);
const canApprove = (emp) => (emp.status === 'pending' || emp.status === 'failed') && emp.active !== false && Boolean(emp.deviceUserId);
const refLabel = (emp) => emp.employeeCode || emp.centralUid || emp.id;
// company_id / branch_id are shown when no name was sent
const withRef = (name, refId) => name || (refId !== null && refId !== undefined ? `#${refId}` : '—');

// navigator.clipboard is unavailable on plain-HTTP LAN addresses
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  document.execCommand('copy');
  document.body.removeChild(area);
}

function CopyButton({ text }) {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);

  const handleCopy = async () => {
    try {
      await copyText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch (err) {
      alert(err.message || 'Copy failed');
    }
  };

  return (
    <button className="btn btn-secondary" onClick={handleCopy} style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
      {done ? <Check size={13} color="#34d399" /> : <Copy size={13} />}
      <span>{done ? t('copied') : t('copyBtn')}</span>
    </button>
  );
}

export default function ApiSettingsPage() {
  const { t, lang } = useTranslation();
  const [settings, setSettings] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [busy, setBusy] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [result, setResult] = useState(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [settingsRes, employeesRes] = await Promise.all([fetchEmployeeApiSettings(), fetchReceivedEmployees()]);
      setSettings(settingsRes.data);
      setEmployees(employeesRes.data || []);
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const pendingIds = useMemo(
    () => employees.filter(canApprove).map(e => e.id),
    [employees]
  );
  const approvedIds = useMemo(
    () => employees.filter(e => e.status === 'approved' && e.active !== false && e.deviceUserId).map(e => e.id),
    [employees]
  );
  const selectedPending = pendingIds.filter(id => selected.has(id));

  const run = async (name, action) => {
    setBusy(name);
    setResult(null);
    try {
      return await action();
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setBusy('');
    }
  };

  const handleToggleEnabled = () => run('toggle', async () => {
    const res = await setEmployeeApiEnabled(!settings.enabled);
    setSettings(res.data);
  });

  const handleGenerateToken = () => {
    if (settings?.hasToken && !window.confirm(t('regenerateTokenConfirm'))) return;
    run('token', async () => {
      const res = await generateEmployeeApiToken();
      setNewToken(res.token);
      setSettings(res.data);
    });
  };

  const handleApprove = (ids) => run('approve', async () => {
    const res = await approveReceivedEmployees(ids);
    setResult({ success: true, message: res.message });
    setSelected(new Set());
    await loadAll();
  });

  const handleDelete = (emp) => {
    if (!window.confirm(t('deleteReceivedConfirm').replace('{id}', refLabel(emp)))) return;
    run('delete', async () => {
      await deleteReceivedEmployee(emp.id);
      await loadAll();
    });
  };

  const handleAssignDeviceId = (emp) => {
    const value = window.prompt(t('assignDeviceIdPrompt').replace('{id}', refLabel(emp)), emp.deviceUserId || '');
    if (value === null || value.trim() === '' || value.trim() === emp.deviceUserId) return;
    run('device-id', async () => {
      const res = await setReceivedEmployeeDeviceId(emp.id, value.trim());
      setResult({ success: true, message: res.message });
      await loadAll();
    });
  };

  const handlePush = () => {
    if (!window.confirm(t('sendApprovedConfirm').replace('{count}', approvedIds.length))) return;
    run('push', async () => {
      try {
        const res = await pushApprovedEmployeesToDevice(approvedIds);
        setResult({ success: res.success, message: res.message, results: res.results });
      } finally {
        await loadAll();
      }
    });
  };

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatDate = (value) => (value ? new Date(value).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB') : '—');

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <KeyRound size={24} color="#6366f1" />
            <h1 className="page-title">{t('apiSettingsTitle')}</h1>
          </div>
          <p className="page-subtitle">{t('apiSettingsSubtitle')}</p>
        </div>

        <button className="btn btn-secondary" onClick={loadAll} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spinner' : ''} />
          <span>{t('refreshBtn')}</span>
        </button>
      </div>

      {/* Manual-only notice */}
      <div className="card" style={{ marginBottom: 20, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(6, 182, 212, 0.08))', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <Info size={20} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('manualSyncNotice')}</div>
        </div>
      </div>

      {/* Result Banner */}
      {result && (
        <div
          style={{
            padding: 14,
            borderRadius: 'var(--radius-md)',
            marginBottom: 20,
            background: result.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${result.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
            color: result.success ? '#34d399' : '#fb7185'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {result.success ? <CheckCircle2 size={20} style={{ flexShrink: 0 }} /> : <AlertTriangle size={20} style={{ flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>{result.message}</div>
              {result.results?.filter(r => r.error).map(r => (
                <div key={r.key} className="mono" style={{ fontSize: '0.78rem', marginTop: 4 }}>
                  {r.deviceUserId}: {r.error}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* API Configuration */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <ShieldCheck size={22} color="#6366f1" />
          <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>{t('menuApiSettings')}</h2>
        </div>

        {/* Receiving URL */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <Link2 size={13} color="#06b6d4" /> {t('receiveUrlLabel')}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(settings?.receiveUrls || []).map(url => (
              <div key={url} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <code className="mono" dir="ltr" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.82rem', color: '#38bdf8', background: 'rgba(15, 23, 42, 0.6)', padding: '7px 10px', borderRadius: 6 }}>
                  POST {url}
                </code>
                <CopyButton text={url} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 6 }}>{t('receiveUrlHint')}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {/* Token */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t('apiTokenLabel')}</label>
            {newToken ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code className="mono" dir="ltr" style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', fontSize: '0.8rem', color: '#fbbf24', background: 'rgba(15, 23, 42, 0.6)', padding: '7px 10px', borderRadius: 6 }}>
                    {newToken}
                  </code>
                  <CopyButton text={newToken} />
                </div>
                <div style={{ fontSize: '0.76rem', color: '#fbbf24', marginTop: 6 }}>{t('tokenShownOnce')}</div>
              </div>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {settings?.hasToken ? (
                  <>
                    <span className="mono" dir="ltr">{settings.tokenHint}</span>
                    <span>  ·  {t('tokenCreatedAt')}: {formatDate(settings.tokenCreatedAt)}</span>
                  </>
                ) : t('noTokenYet')}
              </div>
            )}
            <button className="btn btn-secondary" onClick={handleGenerateToken} disabled={!settings || busy === 'token'} style={{ marginTop: 10 }}>
              <KeyRound size={14} color="#f59e0b" />
              <span>{settings?.hasToken ? t('regenerateTokenBtn') : t('generateTokenBtn')}</span>
            </button>
          </div>

          {/* Enable / Disable */}
          <div>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{t('apiStatusLabel')}</label>
            <div className={`status-pill ${settings?.enabled ? 'online' : 'offline'}`} style={{ display: 'inline-flex' }}>
              <span className="beacon-dot" />
              <span>{settings?.enabled ? t('apiEnabled') : t('apiDisabled')}</span>
            </div>
            <div>
              <button
                className="btn btn-secondary"
                onClick={handleToggleEnabled}
                disabled={!settings || busy === 'toggle' || (!settings.enabled && !settings.hasToken)}
                style={{ marginTop: 10, color: settings?.enabled ? '#fb7185' : '#34d399' }}
              >
                <Power size={14} />
                <span>{settings?.enabled ? t('disableApiBtn') : t('enableApiBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Received Employees */}
      <div className="card">
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={20} color="#6366f1" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>{t('receivedEmployeesTitle')}</h2>
            <span className="badge badge-punch">{employees.length}</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleApprove(selectedPending)}
              disabled={selectedPending.length === 0 || busy !== ''}
            >
              <UserCheck size={15} color="#818cf8" />
              <span>{t('approveSelectedBtn').replace('{count}', selectedPending.length)}</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={handlePush}
              disabled={approvedIds.length === 0 || busy !== ''}
              style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}
            >
              <Fingerprint size={16} className={busy === 'push' ? 'spinner' : ''} />
              <span>{busy === 'push' ? t('sendingToDevice') : t('sendApprovedBtn').replace('{count}', approvedIds.length)}</span>
            </button>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <Users size={32} color="#6366f1" />
            <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.88rem' }}>{t('noReceivedEmployees')}</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={pendingIds.length > 0 && selectedPending.length === pendingIds.length}
                      disabled={pendingIds.length === 0}
                      onChange={(e) => setSelected(e.target.checked ? new Set(pendingIds) : new Set())}
                    />
                  </th>
                  <th>{t('empIdCol')}</th>
                  <th>{t('deviceIdCol')}</th>
                  <th>{t('employeeName')}</th>
                  <th>{t('companyCol')}</th>
                  <th>{t('branchCol')}</th>
                  <th>{t('activeCol')}</th>
                  <th>{t('syncStatusCol')}</th>
                  <th>{t('receivedAtCol')}</th>
                  <th>{t('actionsCol')}</th>
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const style = STATUS_STYLES[emp.status] || STATUS_STYLES.pending;
                  const approvable = canApprove(emp);
                  const deviceLocked = ON_DEVICE.has(emp.status);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(emp.id)}
                          disabled={!approvable}
                          onChange={() => toggleSelect(emp.id)}
                        />
                      </td>
                      <td>
                        <div className="mono" dir="ltr" style={{ whiteSpace: 'nowrap' }}>{emp.employeeCode || '—'}</div>
                        {emp.centralUid && (
                          <div className="mono" dir="ltr" title={t('centralUidLabel')} style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {emp.centralUid}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {emp.deviceUserId
                            ? <span className="mono">{emp.deviceUserId}</span>
                            : <span style={{ fontSize: '0.76rem', color: '#fbbf24' }}>{t('deviceIdMissing')}</span>}
                          {deviceLocked ? (
                            <span title={t('deviceIdLockedHint')} style={{ display: 'inline-flex' }}>
                              <Lock size={12} color="var(--text-muted)" />
                            </span>
                          ) : (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleAssignDeviceId(emp)}
                              disabled={busy !== ''}
                              style={{ padding: '3px 6px', fontSize: '0.72rem' }}
                              title={t('assignDeviceIdBtn')}
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td>{withRef(emp.company, emp.companyId)}</td>
                      <td>{withRef(emp.branch, emp.branchId)}</td>
                      <td>
                        <span
                          className="badge"
                          style={emp.active === false
                            ? { background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }
                            : { background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}
                        >
                          {emp.active === false ? t('activeNo') : t('activeYes')}
                        </span>
                      </td>
                      <td>
                        <span className="badge" style={{ background: style.bg, color: style.color }} title={emp.lastError || ''}>
                          {t(style.key)}
                        </span>
                        {emp.deviceUid && (
                          <div className="mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            {t('deviceUidLabel')}: {emp.deviceUid}
                          </div>
                        )}
                        {(emp.status === 'failed' || emp.status === 'on_device') && emp.lastError && (
                          <div style={{ fontSize: '0.72rem', color: emp.status === 'failed' ? '#fb7185' : 'var(--text-muted)', marginTop: 4, maxWidth: 260 }}>{emp.lastError}</div>
                        )}
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{formatDate(emp.receivedAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {approvable && (
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleApprove([emp.id])}
                              disabled={busy !== ''}
                              style={{ padding: '5px 9px', fontSize: '0.76rem' }}
                            >
                              <UserCheck size={13} />
                              <span>{t('approveBtn')}</span>
                            </button>
                          )}
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleDelete(emp)}
                            disabled={busy !== ''}
                            style={{ padding: '5px 9px', fontSize: '0.76rem', color: '#fb7185' }}
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
