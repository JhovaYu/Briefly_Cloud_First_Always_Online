import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/services/AuthContext';
import { BrieflyLogo } from '../src/components/ui/BrieflyLogo';
import { tokens } from '../src/theme/tokens';

const theme = tokens.dark;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await signIn(email.trim(), password);

    setSubmitting(false);
    if (err) {
      const msg = err.message ?? '';
      if (
        msg.toLowerCase().includes('invalid') ||
        msg.toLowerCase().includes('credentials') ||
        msg.toLowerCase().includes('password')
      ) {
        setError('Email o contraseña incorrectos');
      } else if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch') ||
        msg.toLowerCase().includes('connection')
      ) {
        setError('Sin conexión. Verifica tu internet e inténtalo de nuevo');
      } else {
        setError('No pudimos iniciar sesión. Intenta nuevamente');
      }
    } else {
      router.replace('/home');
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) {
      setError('No pudimos iniciar sesión con Google. Intenta nuevamente.');
    } else {
      router.replace('/home');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrapper}>
          <BrieflyLogo width={140} height={48} />
        </View>

        {/* Header text */}
        <Text style={styles.title}>Bienvenido de vuelta</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar estudiando</Text>

        {/* Google button */}
        <TouchableOpacity
          style={styles.googleBtn}
          activeOpacity={0.7}
          onPress={handleGoogleSignIn}
          disabled={googleLoading || submitting || authLoading}
        >
          {googleLoading ? (
            <ActivityIndicator color={theme.text} size="small" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color={theme.text} />
              <Text style={styles.googleBtnText}>Continuar con Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o continúa con email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email input */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="tu@correo.com"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            editable={!submitting && !authLoading}
          />
        </View>

        {/* Password input */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Contraseña</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Tu contraseña"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              textContentType="password"
              returnKeyType="done"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              editable={!submitting && !authLoading}
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Error message */}
        {error && (
          <View style={styles.errorWrapper}>
            <Ionicons name="alert-circle" size={16} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.ctaBtn, (submitting || authLoading) && styles.ctaBtnDisabled]}
          onPress={handleLogin}
          disabled={submitting || authLoading}
          activeOpacity={0.8}
        >
          {submitting || authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaBtnText}>Iniciar sesión</Text>
          )}
        </TouchableOpacity>

        {/* Links */}
        <View style={styles.linksRow}>
          <Link href="/register" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>¿No tienes cuenta? <Text style={styles.linkBold}>Crear una</Text></Text>
            </TouchableOpacity>
          </Link>
        </View>
        <View style={styles.linksRow}>
          <Link href="/forgot" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 24,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.textMuted,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.border,
  },
  dividerText: {
    fontSize: 12,
    color: theme.textMuted,
    whiteSpace: 'nowrap',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: theme.surface,
    color: theme.text,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.border,
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  errorWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: theme.danger,
    flex: 1,
  },
  ctaBtn: {
    backgroundColor: theme.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  linksRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  linkBold: {
    color: theme.primary,
    fontWeight: '600',
  },
});