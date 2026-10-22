import React, { useState, useMemo } from 'react';
import { Calendar, Download, Search, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { localDateKey } from '../services/date';

export default function DailyAttendancePage({ users, attendances }) {
  const { t } = useTranslation();

  // Default to today or latest available punch date
  const latestDateStr = useMemo(() => {
    if (!attendances.length) return localDateKey(new Date());
    const sorted = [...attendances].sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime));
    return localDateKey(sorted[0].recordTime);
  }, [attendances]);

  const [selectedDate, setSelectedDate] = useState(latestDateStr);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, present, absent

  // Calculate daily attendance matrix
  const dailyMatrix = useMemo(() => {
    const dayPunches = attendances.filter(log => {
      if (!log.recordTime) return false;
      return localDateKey(log.recordTime) === selectedDate;
    });

    const userPunchesMap = {};
    dayPunches.forEach(log => {
      const uId = String(log.deviceUserId);
      if (!userPunchesMap[uId]) userPunchesMap[uId] = [];
      userPunchesMap[uId].push(new Date(log.recordTime));
    });

    return users.map(user => {
      const uId = String(user.userId);
      const punches = (userPunchesMap[uId] || []).sort((a, b) => a - b);
      
      const isPresent = punches.length > 0;
      const firstIn = isPresent ? punches[0] : null;
      const lastOut = isPresent && punches.length > 1 ? punches[punches.length - 1] : null;

      let durationHours = 0;
      let durationStr = '--';
      if (firstIn && lastOut) {
        const diffMs = lastOut - firstIn;
        const totalMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        durationHours = (diffMs / (1000 * 60 * 60)).toFixed(1);
        durationStr = `${hours}h ${mins}m`;
      } else if (firstIn) {
        durationStr = t('pendingOut');
      }

      const isLate = firstIn ? (firstIn.getHours() > 9 || (firstIn.getHours() === 9 && firstIn.getMinutes() > 15)) : false;

      return {
        userId: user.userId,
        name: user.name || `User #${user.userId}`,
        cardno: user.cardno,
        role: user.role,
        isPresent,
        punchCount: punches.length,
        firstIn,
        lastOut,
        durationStr,
        durationHours,
        isLate,
        punches
      };
    });
  }, [users, attendances, selectedDate, t]);

  const filteredRows = useMemo(() => {
    return dailyMatrix.filter(row => {
      const matchesSearch = row.name.toLowerCase().includes(search.toLowerCase()) || String(row.userId).includes(search);
      if (!matchesSearch) return false;

      if (statusFilter === 'present') return row.isPresent;
      if (statusFilter === 'absent') return !row.isPresent;
      if (statusFilter === 'late') return row.isLate;
      return true;
    });
  }, [dailyMatrix, search, statusFilter]);

  const presentCount = dailyMatrix.filter(r => r.isPresent).length;
  const absentCount = dailyMatrix.filter(r => !r.isPresent).length;
  const lateCount = dailyMatrix.filter(r => r.isLate).length;

  const exportCSV = () => {
    const headers = [t('userId'), t('employeeName'), t('date'), t('status'), t('firstIn'), t('lastOut'), t('totalPunchesCol'), t('workDuration')];
    const rows = filteredRows.map(r => {
      const inTime = r.firstIn ? r.firstIn.toLocaleTimeString() : 'N/A';
      const outTime = r.lastOut ? r.lastOut.toLocaleTimeString() : (r.firstIn ? t('pendingOut') : 'N/A');
      return [
        r.userId,
        `"${r.name}"`,
        selectedDate,
        r.isPresent ? t('present') : t('absent'),
        inTime,
        outTime,
        r.punchCount,
        r.durationStr
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Daily_Attendance_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dailyTitle')}</h1>
          <p className="page-subtitle">{t('dailySubtitle')}</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} />
            <span>{t('exportDaily')}</span>
          </button>
        </div>
      </div>

      {/* Date & Filter Toolbar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="#6366f1" />
              <input 
                type="date" 
                className="input"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            </div>

            <div className="search-input-wrapper">
              <Search size={16} />
              <input 
                type="text" 
                className="input input-with-icon"
                placeholder={t('searchEmployee')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <select 
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">{t('allStaff')} ({dailyMatrix.length})</option>
              <option value="present">{t('presentOnly')} ({presentCount})</option>
              <option value="absent">{t('absentOnly')} ({absentCount})</option>
              <option value="late">{t('lateOnly')} ({lateCount})</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem' }}>
            <span style={{ color: '#34d399', fontWeight: 600 }}>{presentCount} {t('present')}</span>
            <span>•</span>
            <span style={{ color: '#fb7185', fontWeight: 600 }}>{absentCount} {t('absent')}</span>
            <span>•</span>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>{lateCount} {t('lateBadge')}</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('employee')}</th>
                <th>{t('status')}</th>
                <th>{t('firstIn')}</th>
                <th>{t('lastOut')}</th>
                <th>{t('totalPunchesCol')}</th>
                <th>{t('workDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const inTime = row.firstIn ? row.firstIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--';
                const outTime = row.lastOut ? row.lastOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : (row.firstIn ? t('pendingOut') : '--');

                return (
                  <tr key={row.userId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="user-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem' }}>
                          {row.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700 }}>{row.name}</div>
                          <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {t('userId')}: {row.userId} {row.cardno ? `• ${t('card')}: ${row.cardno}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {row.isPresent ? (
                        <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                          <CheckCircle2 size={12} /> {t('present')}
                        </span>
                      ) : (
                        <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.25)' }}>
                          <XCircle size={12} /> {t('absent')}
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: row.firstIn ? '#34d399' : 'var(--text-muted)' }}>
                      {inTime}
                      {row.isLate && (
                        <span style={{ marginLeft: 6, marginRight: 6, fontSize: '0.7rem', color: '#f59e0b' }} title="Late arrival">
                          {t('lateBadge')}
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{ fontWeight: 600, color: row.lastOut ? '#06b6d4' : (row.firstIn ? '#f59e0b' : 'var(--text-muted)') }}>
                      {outTime}
                    </td>
                    <td>
                      <span className="badge badge-punch mono">
                        {row.punchCount} {t('punchesCount')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: row.durationStr.includes('h') ? '#818cf8' : 'var(--text-secondary)' }}>
                      {row.durationStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
