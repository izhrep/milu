import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { decryptUserData } from '@/lib/userDataDecryption';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  permissions?: string[];
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  timezone?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Listen for auth changes FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      if (session?.user) {
        // Set basic user data immediately from session
        setUser({
          id: session.user.id,
          full_name: session.user.email || '',
          email: session.user.email || '',
          role: 'employee'
        });
        
        // Load role asynchronously without blocking
        setTimeout(() => {
          if (mounted) {
            loadUserData(session.user.id, session.user.email || '');
          }
        }, 0);
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      if (session?.user) {
        setUser({
          id: session.user.id,
          full_name: session.user.email || '',
          email: session.user.email || '',
          role: 'employee'
        });
        
        // Load role asynchronously
        setTimeout(() => {
          if (mounted) {
            loadUserData(session.user.id, session.user.email || '');
          }
        }, 0);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async (userId: string, email: string) => {
    try {
      // Получаем роль из user_roles напрямую
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleError) {
        console.error('Error fetching user role:', roleError);
      }

      const role = roleData?.role || 'employee';

      // Получаем данные пользователя из таблицы users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('first_name, last_name, middle_name, email, timezone, timezone_manual')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error fetching user data:', userError);
      }

      // Расшифровываем данные пользователя
      let decryptedData = null;
      if (userData?.first_name && userData?.last_name) {
        decryptedData = await decryptUserData({
          first_name: userData.first_name,
          last_name: userData.last_name,
          middle_name: userData.middle_name || '',
          email: userData.email || email,
        });
      }

      // Resolve effective timezone: stored DB value or browser-detected
      const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      let effectiveTz = (userData as any)?.timezone || detectedTz || 'Europe/Moscow';

      // Auto-detect and save browser timezone (fire-and-forget)
      // Respects timezone_manual flag: if user set timezone manually, don't overwrite
      if (detectedTz && !(userData as any)?.timezone_manual) {
        const storedTz = (userData as any)?.timezone;
        if (storedTz !== detectedTz) {
          effectiveTz = detectedTz;
          supabase
            .from('users')
            .update({ timezone: detectedTz } as Record<string, unknown>)
            .eq('id', userId)
            .then(({ error: tzErr }) => {
              if (tzErr) console.error('Failed to save timezone:', tzErr.message);
            });
        }
      }

      // Устанавливаем пользователя с расшифрованными данными
      setUser({
        id: userId,
        full_name: decryptedData ? `${decryptedData.last_name} ${decryptedData.first_name} ${decryptedData.middle_name || ''}`.trim() : email,
        email: email,
        role: role,
        first_name: decryptedData?.first_name || '',
        last_name: decryptedData?.last_name || '',
        middle_name: decryptedData?.middle_name || '',
        timezone: effectiveTz,
      });
    } catch (error) {
      console.error('Error loading user data:', error);
      // Устанавливаем минимальные данные пользователя
      setUser({
        id: userId,
        full_name: email,
        email: email,
        role: 'employee'
      });
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = {
    user,
    logout,
    isAuthenticated: !!user,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
