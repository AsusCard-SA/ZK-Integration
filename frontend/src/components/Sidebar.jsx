import React from 'react';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  Users, 
  FileText, 
  BarChart3, 
  Cpu,
  Fingerprint,
  Radio,
  Send,
  KeyRound
} from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';

export default function Sidebar({ activePage, setActivePage, statusData, deviceConfig }) {
  const { t } = useTranslation();
  const isOnline = statusData?.success && statusData?.data?.status === 'online';

  const menuItems = [
    { id: 'dashboard', label: t('menuDashboard'), icon: LayoutDashboard },
    { id: 'hr-sync', label: t('menuEdaraSync'), icon: Send },
    { id: 'daily', label: t('menuDaily'), icon: CalendarCheck },
    { id: 'employees', label: t('menuEmployees'), icon: Users },
    { id: 'logs', label: t('menuLogs'), icon: FileText },
    { id: 'reports', label: t('menuReports'), icon: BarChart3 },
    { id: 'device', label: t('menuDevice'), icon: Cpu },
    { id: 'api-settings', label: t('menuApiSettings'), icon: KeyRound },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">
          <Fingerprint size={24} />
        </div>
        <div>
          <div className="sidebar-title">{t('systemTitle')}</div>
          <div className="sidebar-subtitle">{t('systemSubtitle')}</div>
        </div>
      </div>

      <div className="sidebar-device-status">
        <div className="sidebar-status-header">
          <Radio size={13} color={isOnline ? '#10b981' : '#f43f5e'} />
          <span>{t('deviceTarget')}</span>
        </div>
        <div className="sidebar-status-ip mono">{deviceConfig ? `${deviceConfig.ip}:${deviceConfig.port}` : 'Loading...'}</div>
        <div className={`sidebar-status-pill ${isOnline ? 'online' : 'offline'}`}>
          <span className="beacon-dot" />
          <span>{isOnline ? t('online') : t('disconnected')}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <Icon size={19} className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-text">
          ZK {deviceConfig?.model || 'MB2000'} Pro • v1.0.0
        </div>
      </div>
    </aside>
  );
}
