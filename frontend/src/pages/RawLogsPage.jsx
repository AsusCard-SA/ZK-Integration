import React, { useState, useMemo } from 'react';
import { Search, Download, Calendar, Filter, UserCheck, Inbox, Clock } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { localDateKey } from '../services/date';

export default function RawLogsPage({ attendances, usersMap, selectedUserIdFilter }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(selectedUserIdFilter || 'all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Format date helper
  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return {
        date: d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };
    } catch {
      return { date: dateStr, time: '' };
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return attendances.filter(log => {
      const userId = String(log.deviceUserId || log.userSn || '');
      const userName = usersMap[userId] || `${t('employee')} #${userId}`;
      const matchesSearch = 
        userName.toLowerCase().includes(search.toLowerCase()) || 
        userId.includes(search);
      
      const matchesUser = selectedUser === 'all' || userId === selectedUser;
      
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && localDateKey(log.recordTime) >= startDate;
      }
      if (endDate) {
        matchesDate = matchesDate && localDateKey(log.recordTime) <= endDate;
      }

      return matchesSearch && matchesUser && matchesDate;
    }).sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime));
  }, [attendances, usersMap, search, selectedUser, startDate, endDate, t]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize) || 1;
  const paginatedLogs = filteredLogs.slice((page - 1) * pageSize, page * pageSize);

  // Export to CSV
  const exportCSV = () => {
    const headers = [t('logSn'), t('userId'), t('employeeName'), t('punchDate'), t('punchTime'), t('deviceSource')];
    const rows = filteredLogs.map(log => {
      const { date, time } = formatDate(log.recordTime);
      const name = usersMap[String(log.deviceUserId)] || 'N/A';
      return [log.userSn, log.deviceUserId, `"${name}"`, date, time, log.ip];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Raw_Attendance_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('rawTitle')}</h1>
          <p className="page-subtitle">{t('rawSubtitle')}</p>
        </div>
        <div>
          <button 
            className="btn btn-secondary"
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
          >
            <Download size={16} />
            <span>{t('exportCSV')} ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div className="search-input-wrapper">
              <Search size={16} />
              <input
                type="text"
                className="input input-with-icon"
                placeholder={t('searchPlaceholder')}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <select 
              className="input"
              value={selectedUser}
              onChange={(e) => { setSelectedUser(e.target.value); setPage(1); }}
            >
              <option value="all">{t('allUsers')} ({Object.keys(usersMap).length})</option>
              {Object.entries(usersMap).map(([id, name]) => (
                <option key={id} value={id}>
                  {name} ({t('userId')}: {id})
                </option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('from')}</span>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t('to')}</span>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              />
            </div>

            {(startDate || endDate) && (
              <button 
                className="btn btn-secondary" 
                onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              >
                {t('clearDates')}
              </button>
            )}
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('showingRecords').replace('{count}', paginatedLogs.length).replace('{total}', filteredLogs.length)}
          </div>
        </div>
      </div>

      <div className="card">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <Inbox size={48} />
            <h3>{t('noRecordsMatch')}</h3>
            <p>{t('noRecordsDesc')}</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('logSn')}</th>
                    <th>{t('userId')}</th>
                    <th>{t('employeeName')}</th>
                    <th>{t('punchDate')}</th>
                    <th>{t('punchTime')}</th>
                    <th>{t('deviceSource')}</th>
                    <th>{t('verification')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.map((log, index) => {
                    const { date, time } = formatDate(log.recordTime);
                    const userName = usersMap[String(log.deviceUserId)] || `${t('employee')} #${log.deviceUserId}`;
                    return (
                      <tr key={index}>
                        <td className="mono" style={{ color: 'var(--text-muted)' }}>#{log.userSn}</td>
                        <td>
                          <span className="badge badge-punch mono">
                            {t('userId')}: {log.deviceUserId}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{userName}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{date}</td>
                        <td className="mono" style={{ color: '#22d3ee', fontWeight: 600 }}>{time}</td>
                        <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{log.ip}</td>
                        <td>
                          <span className="badge badge-user">
                            <Clock size={11} color="#10b981" /> {t('verifiedPunch')}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {t('pageOf')} {page} / {totalPages}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    className="btn btn-secondary" 
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                  >
                    {t('previous')}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  >
                    {t('next')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
