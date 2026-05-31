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

  // fetchProfile ahora devuelve el rol encontrado
  // setLoading(false) lo maneja el llamador DESPUÉS de que esto termine
  const fetchProfile = async (currentUser: User): Promise<void> => {
    console.log('fetchProfile START for user:', currentUser.id);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('role, dispositivo_id, email')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (rolesError) {
        console.error('Error fetching user role:', rolesError);
      }

      let activeRole: 'operador' | 'fundacion' | null = rolesData?.role || null;
      let activeDispositivoId: number | null = rolesData?.dispositivo_id || null;

      // Backfill email si falta
      if (rolesData && !rolesData.email && currentUser.email) {
        await supabase
          .from('user_roles')
          .update({ email: currentUser.email })
          .eq('user_id', currentUser.id);
      }

      // Primer usuario → promover a fundacion automáticamente
      if (!rolesData) {
        const { count, error: countError } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true });

        if (!countError && count === 0) {
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
            console.log('Primer usuario promovido a fundacion automáticamente.');
          } else {
            console.error('Error al promover primer usuario:', insertError);
          }
        }
      }

      // Setear rol y dispositivo
      setRole(activeRole);
      setDispositivoId(activeDispositivoId);

      // Fetch nombre del dispositivo
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

      console.log('fetchProfile END — role:', activeRole, 'dispositivo:', activeDispositivoId);
    } catch (err) {
      console.error('Error en fetchProfile:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let subscription: { unsubscribe: () => void } | null = null;
    let loadedUserId: string | null = null;

    // Safety timeout to prevent infinite loading screen
    const safetyTimeout = setTimeout(() => {
      if (isMounted) {
        console.warn('Safety timeout — forzando loading false');
        setLoading(false);
      }
    }, 15000);

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!isMounted) return;

        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          loadedUserId = currentUser.id;
          await fetchProfile(currentUser);
        }
      } catch (err) {
        console.error('Error al inicializar sesión:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      }

      if (!isMounted) return;

      // Escuchar cambios de auth
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        console.log('onAuthStateChange event:', event, 'user:', session?.user?.id);

        const currentUser = session?.user ?? null;
        setSession(session);
        setUser(currentUser);

        if (currentUser) {
          if (currentUser.id !== loadedUserId) {
            loadedUserId = currentUser.id;
            setLoading(true);
            try {
              await fetchProfile(currentUser);
            } catch (err) {
              console.error('fetchProfile error in auth event:', err);
            } finally {
              if (isMounted) setLoading(false);
            }
          }
        } else {
          loadedUserId = null;
          setRole(null);
          setDispositivoId(null);
          setDispositivoNombre(null);
          if (isMounted) setLoading(false);
        }
      });

      subscription = data.subscription;
    };

    initializeAuth();

    return () => {
      isMounted = false;
      clearTimeout(safetyTimeout);
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  const signOut = async () => {
    setUser(null);
    setSession(null);
    setRole(null);
    setDispositivoId(null);
    setDispositivoNombre(null);
    setLoading(false);
    supabase.auth.signOut().catch((err) => {
      console.error('Error en signOut:', err);
    });
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
