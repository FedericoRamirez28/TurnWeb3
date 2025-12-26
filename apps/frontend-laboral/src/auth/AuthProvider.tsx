import React, { useEffect, useMemo, useState } from 'react';
import {
  authLogin,
  authLogout,
  authMe,
  authRegister,
  type AuthUser,
} from '@/api/authApi';
import { AuthContext, type AuthCtx } from '@/auth/AuthContext';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const u = await authMe();
        if (alive) setUser(u);
      } catch {
        if (alive) setUser(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      loading,

      login: async (username: string, password: string, remember: boolean) => {
        const logged = await authLogin(username, password, remember);
        setUser(logged);
        return logged;
      },

      register: async (
        username: string,
        password: string,
        displayName?: string,
        remember = false,
      ) => {
        const created = await authRegister(
          username,
          password,
          displayName,
          remember,
        );
        setUser(created);
        return created;
      },

      logout: async () => {
        await authLogout();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
