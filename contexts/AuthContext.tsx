'use client';

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes.
    // PENTING: hanya perbarui `user` bila id-nya benar-benar berubah. Supabase
    // memicu TOKEN_REFRESHED (mis. saat tab kembali aktif) dengan objek user
    // baru; tanpa guard ini, referensi `user` berubah → effect ber-dep [user]
    // ikut jalan ulang → data refetch & daftar reset (scroll ke atas).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null;
        setUser((prev) => (prev?.id === nextUser?.id ? prev : nextUser));
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setLoading(false);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signOut }),
    [user, loading, signOut],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
