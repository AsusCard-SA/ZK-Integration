import React, { useState, useMemo } from 'react';
import { BarChart3, Download, Calendar, Search, Award, TrendingUp, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { localDateKey } from '../services/date';

export default function ReportsPage({ users, attendances }) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const reportData = useMemo(() => {
    const monthPunches = attendances.filter(a => {
      if (!a.recordTime) return false;
      return localDateKey(a.recordTime).startsWith(selectedMonth);
    });

    return users.map(user => {
      const uId = String(user.userId);
      const userLogs = monthPunches.filter(p => String(p.deviceUserId) === uId);

      const daysMap = {};
      userLogs.forEach(log => {
        const dayStr = localDateKey(log.recordTime);
        if (!daysMap[dayStr]) daysMap[dayStr] = [];
        daysMap[dayStr].push(new Date(log.recordTime));
      });

      let totalDurationMs = 0;
      let lateArrivals = 0;
      let singlePunchDays = 0;

      Object.values(daysMap).forEach(punches => {
        punches.sort((a, b) => a - b);
        if (punches.length >= 2) {
          totalDurationMs += (punches[punches.length - 1] - punches[0]);
        } else if (punches.length === 1) {
          singlePunchDays++;
        }

        if (punches[0].getHours() > 9 || (punches[0].getHours() === 9 && punches[0].getMinutes() > 15)) {
          lateArrivals++;
        }
      });

      const totalWorkHours = (totalDurationMs / (1000 * 60 * 60)).toFixed(1);
      const daysWorked = Object.keys(daysMap).length;
      const avgHoursPerDay = daysWorked > 0 ? (totalWorkHours / daysWorked).toFixed(1) : '0.0';

      return {
        userId: user.userId,
        name: user.name || `${t('employee')} #${user.userId}`,
        role: user.role === 14 ? t('adminBadge') : t('userBadge'),
        daysWorked,
        totalPunches: userLogs.length,
        totalWorkHours,
        avgHoursPerDay,
        lateArrivals,
        singlePunchDays
      };
    });
  }, [users, attendances, selectedMonth, t]);

  const filteredReport = reportData.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || String(r.userId).includes(search)
  );

  const exportCSV = () => {
    const headers = [t('userId'), t('employeeName'), t('period'), t('daysWorked'), t('totalWorkHours'), t('avgHoursDay'), t('lateArrivals'), t('missingCheckouts')];
    const rows = filteredReport.map(r => [
      r.userId,
      `"${r.name}"`,
      selectedMonth,
      r.daysWorked,
      r.totalWorkHours,
      r.avgHoursPerDay,
      r.lateArrivals,
      r.singlePunchDays
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_Report_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('repTitle')}</h1>
          <p className="page-subtitle">{t('repSubtitle')}</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={exportCSV}>
            <Download size={16} />
            <span>{t('exportTimesheet')}</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="toolbar" style={{ margin: 0 }}>
          <div className="filter-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={18} color="#6366f1" />
              <input
                type="month"
                className="input"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
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
          </div>

          <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {t('period')}: {selectedMonth} • {filteredReport.length} {t('staffMembers')}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('employee')}</th>
                <th>{t('daysWorked')}</th>
                <th>{t('totalWorkHours')}</th>
                <th>{t('avgHoursDay')}</th>
                <th>{t('lateArrivals')}</th>
                <th>{t('missingCheckouts')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReport.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="user-avatar" style={{ width: 34, height: 34, fontSize: '0.8rem' }}>
                        {row.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{row.name}</div>
                        <div className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('userId')}: {row.userId}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-punch mono">
                      {row.daysWorked} {t('days')}
                    </span>
                  </td>
                  <td className="mono" style={{ fontWeight: 700, color: '#38bdf8' }}>
                    {row.totalWorkHours} {t('hrs')}
                  </td>
                  <td className="mono" style={{ color: 'var(--text-secondary)' }}>
                    {row.avgHoursPerDay} {t('hrs')}
                  </td>
                  <td>
                    {row.lateArrivals > 0 ? (
                      <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                        {row.lateArrivals} {t('lateBadge')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>0</span>
                    )}
                  </td>
                  <td>
                    {row.singlePunchDays > 0 ? (
                      <span className="badge" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.3)' }}>
                        <AlertTriangle size={11} /> {row.singlePunchDays} {t('incomplete')}
                      </span>
                    ) : (
                      <span style={{ color: '#34d399', fontSize: '0.85rem' }}>{t('complete')}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
