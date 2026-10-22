import React from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Clock, 
  Activity, 
  ShieldAlert, 
  ArrowUpRight,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { localDateKey } from '../services/date';

export default function DashboardPage({ users, attendances, statusData, onNavigate }) {
  const { t } = useTranslation();
  // Calculations
  const todayStr = localDateKey(new Date());
  
  // Get all unique users who punched today
  const todayPunches = attendances.filter(log => {
    if (!log.recordTime) return false;
    return localDateKey(log.recordTime) === todayStr;
  });

  const presentUserIds = new Set(todayPunches.map(p => String(p.deviceUserId)));
  const presentCount = presentUserIds.size;
  const totalUsers = users.length || 1;
  const absentCount = Math.max(0, totalUsers - presentCount);
  const presenceRate = ((presentCount / totalUsers) * 100).toFixed(0);

  // Recent 10 punch feed
  const recentLogs = [...attendances].sort((a, b) => new Date(b.recordTime) - new Date(a.recordTime)).slice(0, 8);

  const usersMap = {};
  users.forEach(u => {
    usersMap[String(u.userId)] = u.name || `User #${u.userId}`;
  });

  // Calculate hourly punch distribution for today
  const hourlyBuckets = Array(24).fill(0);
  todayPunches.forEach(p => {
    const hour = new Date(p.recordTime).getHours();
    hourlyBuckets[hour]++;
  });

  const peakHour = hourlyBuckets.indexOf(Math.max(...hourlyBuckets));

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('dashTitle')}</h1>
          <p className="page-subtitle">{t('dashSubtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => onNavigate('daily')}>
            <span>{t('viewTodayMatrix')}</span>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-info">
            <div className="stat-label">{t('totalStaff')}</div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-sub">{t('enrolledBiometrics')}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: '#6366f1' }}>
            <Users size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <div className="stat-label">{t('presentToday')}</div>
            <div className="stat-value" style={{ color: '#34d399' }}>{presentCount}</div>
            <div className="stat-sub">{presenceRate}% {t('attendanceRate')}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <UserCheck size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <div className="stat-label">{t('absentToday')}</div>
            <div className="stat-value" style={{ color: absentCount > 0 ? '#fb7185' : 'var(--text-primary)' }}>
              {absentCount}
            </div>
            <div className="stat-sub">{t('noRecordToday')}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e' }}>
            <UserX size={24} />
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-info">
            <div className="stat-label">{t('totalPunches')}</div>
            <div className="stat-value">{attendances.length}</div>
            <div className="stat-sub">{t('deviceBuffer')}: {statusData?.data?.deviceInfo?.logCapacity || 100000}</div>
          </div>
          <div className="stat-icon" style={{ backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4' }}>
            <Activity size={24} />
          </div>
        </div>
      </div>

      {/* Grid: Live Feed & Hourly Peak */}
      <div className="dashboard-columns">
        {/* Recent Activity Feed */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{t('livePunchActivity')}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{t('latestTransactions')}</p>
            </div>
            <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => onNavigate('logs')}>
              {t('fullLedger')}
            </button>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('employee')}</th>
                  <th>{t('punchTime')}</th>
                  <th>{t('date')}</th>
                  <th>{t('verification')}</th>
                </tr>
              </thead>
              <tbody>
                {recentLogs.map((log, index) => {
                  const name = usersMap[String(log.deviceUserId)] || `${t('employee')} #${log.deviceUserId}`;
                  const d = new Date(log.recordTime);
                  return (
                    <tr key={index}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="user-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                            {name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div>{name}</div>
                            <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {log.deviceUserId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="mono" style={{ color: '#22d3ee', fontWeight: 600 }}>
                        {d.toLocaleTimeString()}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>
                      <td>
                        <span className="badge badge-punch">
                          <Clock size={11} /> {t('verified')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Attendance Summary & Device Health */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>
              {t('todayAttendanceRate')}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#6366f1' }}>
                {presenceRate}%
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 10, overflow: 'hidden' }}>
                  <div 
                    style={{ 
                      width: `${presenceRate}%`, 
                      height: '100%', 
                      background: 'linear-gradient(90deg, #6366f1, #06b6d4)',
                      borderRadius: 10
                    }} 
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>
                  <span>{presentCount} {t('present')}</span>
                  <span>{absentCount} {t('absent')}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>
                <TrendingUp size={16} /> {t('peakHour')}: {peakHour}:00 - {peakHour + 1}:00
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4 }}>
                {t('peakDesc')}
              </p>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 14 }}>
              {t('quickActions')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => onNavigate('daily')}>
                {t('dailyReportBtn')}
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('employees')}>
                {t('staffDirectoryBtn')}
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('reports')}>
                {t('timesheetsBtn')}
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('device')}>
                {t('hardwareToolsBtn')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
