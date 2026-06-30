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
    <div style={styles.shell}>
      <header style={styles.header} className="glass">
        <div style={styles.brand}>
          <div style={styles.logo}>
            <ChefHat size={22} color="var(--primary)" />
          </div>
          <span style={styles.brandName}>RestroSathi</span>
        </div>

        <div style={styles.userSection}>
          <div style={styles.userInfo}>
            <User size={16} color="var(--text-muted)" />
            <span style={styles.username}>{user.name}</span>
            <span style={{ ...styles.badge, ...getRoleBadgeStyle(user.role) }}>
              {user.role.toUpperCase()}
            </span>
          </div>

          <div style={styles.actions}>
            <button
              onClick={handleResetDbConnection}
              title="Reset Database Credentials"
              style={styles.actionBtn}
            >
              <Settings size={18} />
            </button>
            <button
              onClick={onLogout}
              title="Sign Out"
              style={{ ...styles.actionBtn, color: 'var(--danger)' }}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main style={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-main)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    borderBottom: '1px solid var(--border-color)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
  },
  brandName: {
    fontFamily: 'var(--font-serif)',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    color: 'var(--text-main)',
  },
  userSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingRight: '20px',
    borderRight: '1px solid var(--border-color)',
  },
  username: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--text-main)',
  },
  badge: {
    fontSize: '10px',
    fontWeight: '700',
    padding: '3px 8px',
    borderRadius: 'var(--radius-full)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
  },
  actionBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '32px',
    maxWidth: '1600px',
    width: '100%',
    margin: '0 auto',
  },
};
