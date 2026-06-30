'use client';

import React, { useState } from 'react';
import { saveSupabaseCredentials, getSupabaseClient } from '@/lib/supabase';
import { Database, Key, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface SetupViewProps {
  onSetupComplete: () => void;
}

export default function SetupView({ onSetupComplete }: SetupViewProps) {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !anonKey) {
      setError('Please fill in both the Supabase URL and Anon Key.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Temporarily save to test
      saveSupabaseCredentials(url, anonKey);
      
      const client = getSupabaseClient();
      if (!client) {
        throw new Error('Could not initialize Supabase client.');
      }

      // Try to query the restaurant_users table to verify connection and schema
      const { error: queryError } = await client
        .from('restaurant_users')
        .select('id')
        .limit(1);

      if (queryError) {
        // If table doesn't exist, tell the user to run the schema sql
        if (queryError.code === 'P0001' || queryError.message.includes('does not exist')) {
          throw new Error('Connected to Supabase, but "restaurant_users" table was not found. Please run the SQL schema script in your Supabase SQL Editor first!');
        }
        throw new Error(`Database query failed: ${queryError.message}`);
      }

      setSuccess(true);
      setTimeout(() => {
        onSetupComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to connect. Please verify your URL and Anon Key.');
      // Clear credentials on failure so we don't save broken ones
      saveSupabaseCredentials('', '');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card} className="glass animate-fade-in">
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <Database size={36} color="var(--primary)" />
          </div>
          <h1 style={styles.title}>RestroSathi Setup</h1>
          <p style={styles.subtitle}>Connect your Supabase Database to initialize the Restaurant Management System</p>
        </div>

        <form onSubmit={handleTestAndSave} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <Database size={16} style={styles.inputIcon} />
              Supabase Project URL
            </label>
            <input
              type="url"
              placeholder="https://xxxxxx.supabase.co"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={loading || success}
              style={styles.input}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>
              <Key size={16} style={styles.inputIcon} />
              Supabase Anon Key
            </label>
            <input
              type="password"
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              required
              disabled={loading || success}
              style={styles.input}
            />
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <AlertCircle size={18} style={styles.errorIcon} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={styles.successContainer}>
              <CheckCircle size={18} style={styles.successIcon} />
              <span>Connection Successful! Loading RestroSathi...</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || success}
            style={styles.button}
            className="glow-hover"
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={18} style={{ marginRight: 8 }} />
                Testing Database Connection...
              </>
            ) : (
              'Connect & Save Database'
            )}
          </button>
        </form>

        <div style={styles.infoBox}>
          <h4 style={{ marginBottom: 4, color: 'var(--primary)', fontSize: 13 }}>First-time Setup Instructions:</h4>
          <ol style={{ paddingLeft: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li>Create a new project on your <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Supabase Dashboard</a>.</li>
            <li>Go to the <strong>SQL Editor</strong> tab and create a new query.</li>
            <li>Copy the contents of <code>supabase_schema.sql</code> (located in the project folder) and paste it into the editor, then click <strong>Run</strong>.</li>
            <li>Go to <strong>Project Settings &gt; API</strong>, copy the Project URL and Anon API Key, and paste them above.</li>
          </ol>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
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
    maxWidth: '520px',
    padding: '40px',
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
    width: '72px',
    height: '72px',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    marginBottom: '16px',
    boxShadow: 'var(--shadow-glow)',
  },
  title: {
    fontFamily: 'var(--font-serif)',
    fontSize: '28px',
    fontWeight: '700',
    color: 'var(--text-main)',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
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
    lineHeight: '1.4',
  },
  errorIcon: {
    flexShrink: 0,
  },
  successContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: 'var(--radius-sm)',
    padding: '12px',
    color: 'var(--success)',
    fontSize: '13px',
  },
  successIcon: {
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
    padding: '14px',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'var(--transition-fast)',
    marginTop: '8px',
  },
  infoBox: {
    backgroundColor: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    padding: '16px',
    marginTop: '32px',
  },
};
