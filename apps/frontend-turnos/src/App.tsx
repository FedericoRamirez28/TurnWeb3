import React from 'react';
import { AuthProvider } from '@/auth/AuthProvider';
import { useAuth } from '@/auth/useAuth';
import LoginScreen from '@/components/screens/LoginScreen';
import { HomeScreen } from './components/screens/HomeScreen';

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <LoginScreen />;
  return <HomeScreen />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
