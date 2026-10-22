import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import DailyAttendancePage from './pages/DailyAttendancePage';
import EmployeesPage from './pages/EmployeesPage';
import RawLogsPage from './pages/RawLogsPage';
import ReportsPage from './pages/ReportsPage';
import DevicePage from './pages/DevicePage';
import HRSyncPage from './pages/HRSyncPage';
import ApiSettingsPage from './pages/ApiSettingsPage';
import { fetchDeviceStatus, fetchUsers, fetchAttendances, fetchDeviceConfig } from './services/api';
import { RefreshCw, Radio, Bell, Globe } from 'lucide-react';
import { useTranslation } from './context/LanguageContext';

export default function App() {
  const { t, lang, toggleLanguage, setDeviceDetails } = useTranslation();
  const [activePage, setActivePage] = useState('dashboard');
  const [statusData, setStatusData] = useState(null);
  const [deviceConfig, setDeviceConfig] = useState(null);
  const [users, setUsers] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserFilter, setSelectedUserFilter] = useState('');

  // Map userId -> Name for quick lookup
  const usersMap = useMemo(() => {
    const map = {};
    users.forEach(u => {
      const id = String(u.userId);
      map[id] = u.name || `User #${id}`;
    });
    return map;
  }, [users]);

  // Load all device data
  const loadData = async () => {
    setLoading(true);
    try {
      const [configRes, statusRes, usersRes, attRes] = await Promise.allSettled([
        fetchDeviceConfig(),
        fetchDeviceStatus(),
        fetchUsers(),
        fetchAttendances()
      ]);

      if (configRes.status === 'fulfilled') {
        setDeviceConfig(configRes.value);
        setDeviceDetails(configRes.value);
      }
      setStatusData(statusRes.status === 'fulfilled' ? statusRes.value : null);
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data || []);
      if (attRes.status === 'fulfilled') setAttendances(attRes.value.data || []);
    } catch (err) {
      console.error('Error fetching ZK device data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (deviceConfig?.model) document.title = `ZKTeco ${deviceConfig.model} Dashboard`;
  }, [deviceConfig]);

  const handleSelectEmployee = (userId) => {
    setSelectedUserFilter(userId);
    setActivePage('logs');
  };

  const isOnline = statusData?.success && statusData?.data?.status === 'online';

  return (
    <div className="layout-root">
      {/* Sidebar Navigation */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        statusData={statusData}
        deviceConfig={deviceConfig}
      />

      {/* Main Content Area */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
              {t('topbarTitle')}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Language Switcher */}
            <button 
              className="btn btn-secondary"
              onClick={toggleLanguage}
              style={{ fontWeight: 700, minWidth: 95 }}
              title="تغيير اللغة / Switch Language"
            >
              <Globe size={15} color="#06b6d4" />
              <span>{lang === 'ar' ? 'English' : 'عربي (AR)'}</span>
            </button>

            <div className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
              <span className="beacon-dot" />
              <span>{isOnline ? t('machineOnline') : t('machineOffline')}</span>
            </div>

            <button 
              className="btn btn-secondary" 
              onClick={loadData} 
              disabled={loading}
              title="Refresh device logs and users"
            >
              <RefreshCw size={15} className={loading ? 'spinner' : ''} />
              <span>{loading ? t('syncing') : t('syncDevice')}</span>
            </button>
          </div>
        </header>

        {/* Page Views */}
        <div className="page-body">
          {activePage === 'dashboard' && (
            <DashboardPage 
              users={users}
              attendances={attendances}
              statusData={statusData}
              onNavigate={setActivePage}
            />
          )}

          {activePage === 'hr-sync' && (
            <HRSyncPage 
              users={users}
              attendances={attendances}
            />
          )}

          {activePage === 'daily' && (
            <DailyAttendancePage 
              users={users}
              attendances={attendances}
            />
          )}

          {activePage === 'employees' && (
            <EmployeesPage 
              users={users}
              attendances={attendances}
              onSelectEmployee={handleSelectEmployee}
              onRefresh={loadData}
            />
          )}

          {activePage === 'logs' && (
            <RawLogsPage 
              attendances={attendances}
              usersMap={usersMap}
              selectedUserIdFilter={selectedUserFilter}
            />
          )}

          {activePage === 'reports' && (
            <ReportsPage 
              users={users}
              attendances={attendances}
            />
          )}

          {activePage === 'api-settings' && <ApiSettingsPage />}

          {activePage === 'device' && (
            <DevicePage 
              statusData={statusData}
              deviceConfig={deviceConfig}
              onRefresh={loadData}
            />
          )}
        </div>
      </main>
    </div>
  );
}
