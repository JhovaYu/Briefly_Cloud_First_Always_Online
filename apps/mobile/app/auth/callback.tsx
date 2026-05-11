import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSearchParams } from 'expo-router';
import { supabase } from '../../src/services/supabase';
import { tokens } from '../../src/theme/tokens';

const theme = tokens.dark;

export default function AuthCallbackScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  console.log('[OAuthCallback] callback route mounted');
  console.log('[OAuthCallback] code present:', searchParams.code != null);

  useEffect(() => {
    const code = searchParams.code as string | null;

    if (!code) {
      router.replace('/login');
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        console.log('[OAuthCallback] session exchange success: false');
        router.replace('/login');
      } else {
        console.log('[OAuthCallback] session exchange success: true');
        router.replace('/home');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});