import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/services/AuthContext';

export default function Index() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace('/home');
    } else {
      router.replace('/login');
    }
  }, [session, loading]);

  return null;
}
