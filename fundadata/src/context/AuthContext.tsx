import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: 'operador' | 'fundacion' | null;
  dispositivoId: number | null;
  dispositivoNombre: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'operador' | 'fundacion' | null>(null);
  const [dispositivoId, setDispositivoId] = useState<number | null>(null);
  const [dispositivoNombre, setDispositivoNombre] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = async (currentUser: User) => {
    try {
      // 1. Query the user_roles table for this user
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, dispositivo_id')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (rolesError) {
        console.error('Error fetching user role:', rolesError);
      }

      let activeRole: 'operador' | 'fundacion' | null = rolesData?.role || null;
      let activeDispositivoId: number | null = rolesData?.dispositivo_id || null;

      // 2. If no role exists, check if this is the FIRST user in the database
      if (!rolesData) {
        const { count, error: countError } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true });

        if (!countError && count === 0) {
          // No users exist in user_roles. Automatically promote this first user to 'fundacion'
          const { data: newRole, error: insertError } = await supabase
            .from('user_roles')
            .insert({
              user_id: currentUser.id,
              role: 'fundacion',
              dispositivo_id: null,
            })
            .select('role, dispositivo_id')
            .maybeSingle();

          if (!insertError && newRole) {
            activeRole = newRole.role;
            activeDispositivoId = newRole.dispositivo_id;
            console.log('Automatically promoted first registered user to fundacion.');
          } else {
            console.error('Failed to auto-promote first user to fundacion:', insertError);
          }
        }
      }

      setRole(activeRole);
      setDispositivoId(activeDispositivoId);

      // 3. Fetch device name if there's a device assigned
      if (activeDispositivoId) {
        const { data: devData, error: devError } = await supabase
          .from('dispositivo')
          .select('nombre')
          .eq('id', activeDispositivoId)
          .maybeSingle();

        if (!devError && devData) {
          setDispositivoNombre(devData.nombre);
        } else {
          setDispositivoNombre('Centro Asignado');
        }
      } else {
        setDispositivoNombre(null);
      }
    } catch (err) {
      console.error('Error in profile retrieval:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    // Safety timeout: force loading to false after 3.5 seconds if auth check hangs
    const safetyTimeout = setTimeout(() => {
      console.warn('FundaData safety timeout: Auth loading took too long, forcing load state to false.');
      setLoading(false);
    }, 3500);

    // Check active session on mount
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user)
            .then(() => {
              clearTimeout(safetyTimeout);
              setLoading(false);
            })
            .catch((err) => {
              console.error('Error fetching profile on mount:', err);
              clearTimeout(safetyTimeout);
              setLoading(false);
            });
        } else {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to get session on mount:', err);
        clearTimeout(safetyTimeout);
        setLoading(false);
      });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      let localTimeout: any = null;
      try {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Only show loading screen if transitioning to SIGNED_IN state
          if (event === 'SIGNED_IN') {
            setLoading(true);
            localTimeout = setTimeout(() => {
              console.warn('FundaData safety timeout: Auth change loading took too long, forcing load state to false.');
              setLoading(false);
            }, 3500);
          }
          await fetchProfile(session.user);
          if (localTimeout) clearTimeout(localTimeout);
          setLoading(false);
        } else {
          setRole(null);
          setDispositivoId(null);
          setDispositivoNombre(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error handling auth state change:', err);
        if (localTimeout) clearTimeout(localTimeout);
        setLoading(false);
      }
    });

    return () => {
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Clear local state instantly so the UI redirects immediately
    setUser(null);
    setSession(null);
    setRole(null);
    setDispositivoId(null);
    setDispositivoNombre(null);
    setLoading(false);

    // Run the Supabase auth API logout in the background
    try {
      supabase.auth.signOut().catch((err) => {
        console.error('Background Supabase signout failed:', err);
      });
    } catch (err) {
      console.error('Error initiating background sign out:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        dispositivoId,
        dispositivoNombre,
        loading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
