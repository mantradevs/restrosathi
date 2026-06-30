'use client';

import React, { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';
import { ChefHat, User, Lock, AlertCircle, RefreshCw } from 'lucide-react';

interface LoginViewProps {
  onLoginSuccess: (user: { id: string; username: string; name: string; role: 'owner' | 'admin' | 'staff' }) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Supabase database client is not initialized.');
      }

      // Query the user table
      const { data, error: queryError } = await client
        .from('restaurant_users')
        .select('*')
        .eq('username', username.trim().toLowerCase())
        .limit(1);

      if (queryError) {
        throw queryError;
      }

      if (!data || data.length === 0) {
        throw new Error('Invalid username or password.');
      }

      const userRecord = data[0];

      // Check password (simple comparison for standard credentials)
      if (userRecord.password !== password) {
        throw new Error('Invalid username or password.');
      }

      // Login success
      const sessionUser = {
        id: userRecord.id,
        username: userRecord.username,
        name: userRecord.name,
        role: userRecord.role as 'owner' | 'admin' | 'staff'
      };

      // Save to localStorage
      localStorage.setItem('restrosathi_user_session', JSON.stringify(sessionUser));
      onLoginSuccess(sessionUser);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
  };

  return (
    <div style={styles.container}>
      <div style={styles.card} className="glass animate-fade-in">
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <ChefHat size={36} color="var(--primary)" />
          </div>
          <h1 style={styles.title}>RestroSathi</h1>
          <p style={styles.subtitle}>Restaurant Operations & Order Management System</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <User size={16} style={styles.inputIcon} />
              Username
            </label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <Lock size={16} style={styles.inputIcon} />
              Password
            </label>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              style={styles.input}
            />
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <AlertCircle size={18} style={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={styles.button}
            className="glow-hover"
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={18} style={{ marginRight: 8 }} />
                Authenticating...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div style={styles.demoSection}>
          <h4 style={styles.demoTitle}>Quick-Select Demo Accounts</h4>
          <div style={styles.demoButtonsGrid}>
            <button
              onClick={() => handleQuickLogin('owner', 'owner123')}
              style={{ ...styles.demoButton, borderLeft: '3px solid var(--primary)' }}
            >
              <span style={styles.demoRole}>Owner</span>
              <span style={styles.demoUser}>owner / owner123</span>
            </button>
            <button
              onClick={() => handleQuickLogin('admin', 'admin123')}
              style={{ ...styles.demoButton, borderLeft: '3px solid var(--secondary)' }}
            >
              <span style={styles.demoRole}>Admin</span>
              <span style={styles.demoUser}>admin / admin123</span>
            </button>
            <button
              onClick={() => handleQuickLogin('staff', 'staff123')}
              style={{ ...styles.demoButton, borderLeft: '3px solid var(--success)' }}
            >
              <span style={styles.demoRole}>Staff</span>
              <span style={styles.demoUser}>staff / staff123</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '24px',
    background: 'radial-gradient(circle at center, #111a2e 0%, var(--bg-main) 100%)',
  },
  card: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px 32px',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '64px',
    height: '64px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    marginBottom: '16px',
    boxShadow: 'var(--shadow-glow)',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '32px',
    fontWeight: '700',
    color: 'var(--text-main)',
    letterSpacing: '1px',
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-muted)',
  },
  inputIcon: {
    color: 'var(--primary)',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
  },
  errorContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px',
    color: 'var(--danger)',
    fontSize: '13px',
  },
  errorIcon: {
    flexShrink: 0,
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--primary)',
    color: 'var(--bg-main)',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '12px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    marginTop: '6px',
  },
  demoSection: {
    marginTop: '32px',
    paddingTop: '24px',
    borderTop: '1px solid var(--border-color)',
  },
  demoTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    marginBottom: '12px',
    textAlign: 'center',
  },
  demoButtonsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  demoButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '10px 14px',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    textAlign: 'left',
    color: 'var(--text-main)',
  },
  demoRole: {
    fontSize: '13px',
    fontWeight: '600',
  },
  demoUser: {
    fontSize: '12px',
    color: 'var(--text-muted)',
  },
};
