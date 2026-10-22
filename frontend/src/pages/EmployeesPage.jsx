import React, { useState } from 'react';
import { Search, Shield, User, CreditCard, Download, UserPlus, Filter, Edit3, Trash2, Check, X, RefreshCw } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { renameDeviceUser, deleteDeviceUser } from '../services/api';

// The device stores names in 24 bytes
const MAX_NAME_LENGTH = 23;

export default function EmployeesPage({ users, attendances, onSelectEmployee, onRefresh }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editingUid, setEditingUid] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [busyUid, setBusyUid] = useState(null);
  const [notice, setNotice] = useState(null);

  const startEdit = (user) => {
    setEditingUid(user.uid);
    setNameDraft(user.name || '');
    setNotice(null);
  };

  const cancelEdit = () => {
    setEditingUid(null);
    setNameDraft('');
  };

  const saveName = async (user) => {
    const name = nameDraft.trim();
    if (!name) {
      setNotice({ success: false, message: t('nameRequired') });
      return;
    }
    if (name === (user.name || '')) {
      cancelEdit();
      return;
    }
    setBusyUid(user.uid);
    try {
      await renameDeviceUser(user.uid, user.userId, name);
      setNotice({ success: true, message: t('userRenamed').replace('{id}', user.userId) });
      cancelEdit();
      if (onRefresh) await onRefresh();
    } catch (err) {
      setNotice({ success: false, message: err.message });
    } finally {
      setBusyUid(null);
    }
  };

  const removeUser = async (user) => {
    let msg = t('deleteDeviceUserConfirm')
      .replace('{name}', user.name || `#${user.userId}`)
      .replace('{id}', user.userId);
    if (user.role === 14) msg += t('adminDeleteWarning');
    if (!window.confirm(msg)) return;

    setBusyUid(user.uid);
    setNotice(null);
    try {
      await deleteDeviceUser(user.uid, user.userId);
      setNotice({ success: true, message: t('userDeleted').replace('{id}', user.userId) });
      if (onRefresh) await onRefresh();
    } catch (err) {
      setNotice({ success: false, message: err.message });
    } finally {
      setBusyUid(null);
    }
  };

  // Count punches per employee
  const punchCounts = {};
  attendances.forEach(a => {
    const id = String(a.deviceUserId);
    punchCounts[id] = (punchCounts[id] || 0) + 1;
  });

  const filteredUsers = users.filter(user => {
    const name = (user.name || '').toLowerCase();
    const id = String(user.userId || '');
    const card = String(user.cardno || '');
    const q = search.toLowerCase();
    const matchesSearch = name.includes(q) || id.includes(q) || card.includes(q);

    if (!matchesSearch) return false;
    if (roleFilter === 'admin') return user.role === 14;
    if (roleFilter === 'user') return user.role !== 14;
    return true;
  });

  const exportCSV = () => {
    const headers = [t('userId'), 'UID', t('employeeName'), t('status'), t('card'), t('totalPunchesCol')];
    const rows = filteredUsers.map(u => [
      u.userId,
      u.uid,
      `"${u.name || ''}"`,
      u.role === 14 ? t('adminBadge') : t('userBadge'),
      u.cardno || 0,
      punchCounts[String(u.userId)] || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZK_Employees_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('empTitle')}</h1>
          <p className="page-subtitle">{t('empSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} />
            <span>{t('exportStaff')}</span>
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                className="input input-with-icon"
                placeholder={t('searchEmpPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select 
              className="input"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">{t('allRoles')} ({users.length})</option>
              <option value="admin">{t('adminOnly')}</option>
              <option value="user">{t('userOnly')}</option>
            </select>
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {t('showingEmployees').replace('{count}', filteredUsers.length)}
          </div>
        </div>
      </div>

      {notice && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: 16,
            fontSize: '0.85rem',
            fontWeight: 600,
            background: notice.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)',
            border: `1px solid ${notice.success ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}`,
            color: notice.success ? '#34d399' : '#fb7185'
          }}
        >
          {notice.message}
        </div>
      )}

      {/* Employee Cards Grid */}
      <div className="user-grid">
        {filteredUsers.map((user) => {
          const isAdmin = user.role === 14;
          const totalPunches = punchCounts[String(user.userId)] || 0;
          const initials = user.name
            ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
            : `U${user.userId}`;

          return (
            <div 
              key={user.userId} 
              className={`user-card ${isAdmin ? 'admin' : ''}`}
              onClick={() => onSelectEmployee && onSelectEmployee(user.userId)}
              style={{ cursor: 'pointer' }}
            >
              <div className="user-avatar">
                {initials}
              </div>
              <div className="user-details">
                {editingUid === user.uid ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      className="input"
                      value={nameDraft}
                      maxLength={MAX_NAME_LENGTH}
                      autoFocus
                      disabled={busyUid === user.uid}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName(user);
                        if (e.key === 'Escape') cancelEdit();
                      }}
                      style={{ flex: 1, minWidth: 0, padding: '5px 8px', fontSize: '0.85rem' }}
                    />
                    <button
                      className="btn btn-secondary"
                      onClick={() => saveName(user)}
                      disabled={busyUid === user.uid}
                      style={{ padding: '5px 7px' }}
                      title={t('saveNameBtn')}
                    >
                      {busyUid === user.uid ? <RefreshCw size={13} className="spinner" /> : <Check size={13} color="#34d399" />}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={cancelEdit}
                      disabled={busyUid === user.uid}
                      style={{ padding: '5px 7px' }}
                      title={t('cancelBtn')}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div className="user-name" style={{ flex: 1, minWidth: 0 }}>
                      {user.name || `${t('userId')} #${user.userId}`}
                    </div>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => { e.stopPropagation(); startEdit(user); }}
                      disabled={busyUid !== null}
                      style={{ padding: '4px 6px' }}
                      title={t('editNameBtn')}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => { e.stopPropagation(); removeUser(user); }}
                      disabled={busyUid !== null}
                      style={{ padding: '4px 6px', color: '#fb7185' }}
                      title={t('deleteUserBtn')}
                    >
                      {busyUid === user.uid ? <RefreshCw size={12} className="spinner" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                )}
                <div className="user-meta">
                  <span className="mono">{t('userId')}: {user.userId}</span>
                  <span>•</span>
                  {user.cardno && user.cardno !== 0 ? (
                    <span className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      <CreditCard size={12} /> {user.cardno}
                    </span>
                  ) : (
                    <span>{t('biometric')}</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                  {isAdmin ? (
                    <span className="badge badge-admin">
                      <Shield size={11} /> {t('adminBadge')}
                    </span>
                  ) : (
                    <span className="badge badge-user">
                      <User size={11} /> {t('userBadge')}
                    </span>
                  )}

                  <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {totalPunches} {t('logsCount')}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
