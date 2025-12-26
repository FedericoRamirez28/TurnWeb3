import { useContext } from 'react';
import { AuthContext } from '@/auth/AuthContext';


export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return v;
}
