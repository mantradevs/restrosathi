'use client';

import React from 'react';
import { clearSupabaseCredentials } from '@/lib/supabase';
import { ChefHat, LogOut, Settings, User } from 'lucide-react';

interface UserSession {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'admin' | 'staff';
}

interface DashboardShellProps {
  user: UserSession;
  onLogout: () => void;
  onResetDb: () => void;
  children: React.ReactNode;
}

export default function DashboardShell({ user, onLogout, onResetDb, children }: DashboardShellProps) {
  const getRoleBadgeStyle = (role: string): React.CSSProperties => {
    switch (role) {
      case 'owner':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.15)',
          color: 'var(--primary)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        };
      case 'admin':
        return {
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--secondary)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
        };
      case 'staff':
      default:
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
        };
    }
  };

  const handleResetDbConnection = () => {
    clearSupabaseCredentials();
    localStorage.removeItem('restrosathi_user_session');
    onResetDb();
  };

  return (
    <div className="dashboard-shell">
      <header className="dashboard-header glass">
        <div className="dashboard-brand">
          <div className="dashboard-logo">
            <ChefHat size={22} color="var(--primary)" />
          </div>
          <span className="dashboard-brand-name">RestroSathi</span>
        </div>

        <div className="dashboard-user-section">
          <div className="dashboard-user-info">
            <User size={16} color="var(--text-muted)" />
            <span className="dashboard-username">{user.name}</span>
            <span className="dashboard-badge" style={getRoleBadgeStyle(user.role)}>
              {user.role.toUpperCase()}
            </span>
          </div>

          <div className="dashboard-actions">
            <button
              onClick={handleResetDbConnection}
              title="Reset Database Credentials"
              className="dashboard-action-btn"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="dashboard-action-btn"
              style={{ color: 'var(--danger)' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main-content">
        {children}
      </main>
    </div>
  );
}
