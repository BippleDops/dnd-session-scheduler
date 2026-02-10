'use client';
import { useState, useEffect, createContext, useContext } from 'react';
import { getMyRole, type UserRole } from '@/lib/api';

interface AuthContextType {
  user: UserRole | null;
  loading: boolean;
  isAdmin: boolean;
  isLoggedIn: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null, loading: true, isAdmin: false, isLoggedIn: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function useAuthProvider() {
  const [user, setUser] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyRole()
      .then(role => { setUser(role.email ? role : null); })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return {
    user,
    loading,
    isAdmin: user?.isAdmin ?? false,
    isLoggedIn: !!user?.email,
  };
}

