import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Get credentials from environment variables or localStorage
export const getSupabaseCredentials = () => {
  if (typeof window === 'undefined') {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      isConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    };
  }

  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const localUrl = window.localStorage.getItem('restrosathi_supabase_url');
  const localKey = window.localStorage.getItem('restrosathi_supabase_anon_key');

  const url = envUrl || localUrl || '';
  const anonKey = envKey || localKey || '';

  return {
    url,
    anonKey,
    isConfigured: !!(url && anonKey)
  };
};

let supabaseInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (supabaseInstance) return supabaseInstance;

  const { url, anonKey, isConfigured } = getSupabaseCredentials();

  if (!isConfigured) return null;

  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: false // We use custom table-based session management for roles
      }
    });
    return supabaseInstance;
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return null;
  }
};

export const saveSupabaseCredentials = (url: string, anonKey: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('restrosathi_supabase_url', url);
  window.localStorage.setItem('restrosathi_supabase_anon_key', anonKey);
  supabaseInstance = null; // Reset instance to force re-creation
};

export const clearSupabaseCredentials = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('restrosathi_supabase_url');
  window.localStorage.removeItem('restrosathi_supabase_anon_key');
  supabaseInstance = null;
};
