'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseCredentials } from '@/lib/supabase';
import SetupView from '@/components/SetupView';
import LoginView from '@/components/LoginView';
import DashboardShell from '@/components/DashboardShell';
import OwnerDashboard from '@/components/OwnerDashboard';
import AdminDashboard from '@/components/AdminDashboard';
import StaffDashboard from '@/components/StaffDashboard';
import { ChefHat, RefreshCw } from 'lucide-react';

interface UserSession {
  id: string;
  username: string;
  name: string;
  role: 'owner' | 'admin' | 'staff';
}

export default function RootPage() {
  const [isClient, setIsClient] = useState(false);
  const [dbConfigured, setDbConfigured] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Run on client mount
  useEffect(() => {
    setIsClient(true);
    checkConfigurationAndSession();
  }, []);

  const checkConfigurationAndSession = () => {
    setLoading(true);
    try {
      // 1. Check if database is configured
      const credentials = getSupabaseCredentials();
      setDbConfigured(credentials.isConfigured);

      // 2. Check if there is a logged-in user in local storage
      const storedSession = localStorage.getItem('restrosathi_user_session');
      if (storedSession) {
        setCurrentUser(JSON.parse(storedSession));
      } else {
        setCurrentUser(null);
      }
    } catch (e) {
      console.error('Error loading initial session configuration:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupComplete = () => {
    checkConfigurationAndSession();
  };

  const handleLoginSuccess = (user: UserSession) => {
    setCurrentUser(user);
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to sign out?')) {
      localStorage.removeItem('restrosathi_user_session');
      setCurrentUser(null);
    }
  };

  const handleResetDb = () => {
    setCurrentUser(null);
    setDbConfigured(false);
  };

  // Prevent hydration discrepancies between server and client rendering
  if (!isClient || loading) {
    return (
      <div style={styles.loadingContainer}>
        <ChefHat size={48} color="var(--primary)" className="pulse" />
        <p style={{ marginTop: 16, fontSize: '15px', color: 'var(--text-muted)' }}>
          Loading RestroSathi...
        </p>
        <style jsx global>{`
          @keyframes pulse {
            0% { opacity: 0.6; transform: scale(0.95); }
            50% { opacity: 1; transform: scale(1.05); }
            100% { opacity: 0.6; transform: scale(0.95); }
          }
          .pulse {
            animation: pulse 1.5s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // 1. Show setup view if database is not configured
  if (!dbConfigured) {
    return <SetupView onSetupComplete={handleSetupComplete} />;
  }

  // 2. Show login view if no user session exists
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // 3. Render appropriate dashboard view inside app shell based on role
  return (
    <DashboardShell 
      user={currentUser} 
      onLogout={handleLogout} 
      onResetDb={handleResetDb}
    >
      {currentUser.role === 'owner' && (
        <OwnerDashboard user={currentUser} />
      )}
      {currentUser.role === 'admin' && (
        <AdminDashboard user={currentUser} />
      )}
      {currentUser.role === 'staff' && (
        <StaffDashboard user={currentUser} />
      )}
    </DashboardShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#0b0f19',
  },
};
