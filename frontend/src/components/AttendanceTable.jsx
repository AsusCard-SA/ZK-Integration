import React, { useState, useMemo } from 'react';
import { localDateKey } from '../services/date';
import { Search, Download, Calendar, Filter, UserCheck, Inbox } from 'lucide-react';

export default function AttendanceTable({ attendances, usersMap, loading }) {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

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
      const userName = usersMap[userId] || `User #${userId}`;
      const matchesSearch = 
        userName.toLowerCase().includes(search.toLowerCase()) || 
        userId.includes(search);
      
      const matchesUser = selectedUser === 'all' || userId === selectedUser;
      
      let matchesDate = true;
      if (dateFilter) {
        const logDate = localDateKey(log.recordTime);
        matchesDate = logDate === dateFilter;
      }

      return matchesSearch && matchesUser && matchesDate;
    });
  }, [attendances, usersMap, search, selectedUser, dateFilter]);

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Log SN', 'User ID', 'Name', 'Date', 'Time', 'IP'];
    const rows = filteredLogs.map(log => {
      const { date, time } = formatDate(log.recordTime);
      const name = usersMap[String(log.deviceUserId)] || 'N/A';
      return [log.userSn, log.deviceUserId, `"${name}"`, date, time, log.ip];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ZK_MB2000_Attendance_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card animate-fade-in">
      <div className="toolbar">
        <div className="filter-group">
          <div className="search-input-wrapper">
            <Search size={16} />
            <input
              type="text"
              className="input input-with-icon"
              placeholder="Search by name or User ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select 
            className="input"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="all">All Users ({Object.keys(usersMap).length})</option>
            {Object.entries(usersMap).map(([id, name]) => (
              <option key={id} value={id}>
                {name} (ID: {id})
              </option>
            ))}
          </select>

          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by punch date"
          />

          {dateFilter && (
            <button className="btn btn-secondary" onClick={() => setDateFilter('')}>
              Clear Date
            </button>
          )}
        </div>

        <div>
          <button 
            className="btn btn-secondary"
            onClick={exportCSV}
            disabled={filteredLogs.length === 0}
          >
            <Download size={16} />
            <span>Export CSV ({filteredLogs.length})</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%' }} />
          <p style={{ marginTop: 12 }}>Reading punches from ZKTeco MB2000...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="empty-state">
          <Inbox size={48} />
          <h3>No attendance logs found</h3>
          <p>Try adjusting your search query or filters.</p>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Log SN</th>
                <th>User ID</th>
                <th>Employee / Name</th>
                <th>Punch Date</th>
                <th>Punch Time</th>
                <th>Verification State</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, index) => {
                const { date, time } = formatDate(log.recordTime);
                const userName = usersMap[String(log.deviceUserId)] || 'Unassigned User';
                return (
                  <tr key={index}>
                    <td className="mono" style={{ color: 'var(--text-muted)' }}>#{log.userSn}</td>
                    <td>
                      <span className="badge badge-punch mono">
                        ID: {log.deviceUserId}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {userName}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{date}</td>
                    <td className="mono" style={{ color: '#22d3ee', fontWeight: 600 }}>{time}</td>
                    <td>
                      <span className="badge badge-user">
                        <UserCheck size={12} color="#10b981" />
                        Verified Fingerprint / Face
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
