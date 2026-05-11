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

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) return;
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setSubmitting(true);
    setError(null);

    const { error: err } = await signUp(email.trim(), password, name.trim() || undefined);

    setSubmitting(false);
    if (err) {
      const msg = err.message ?? '';
      if (msg.toLowerCase().includes('email')) {
        setError('Este correo ya está registrado');
      } else if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch')
      ) {
        setError('Sin conexión. Verifica tu internet e inténtalo de nuevo');
      } else {
        setError('No pudimos crear la cuenta. Intenta nuevamente');
      }
    } else {
      setSuccess(true);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) {
      setError('No pudimos crear la cuenta con Google. Intenta nuevamente.');
    } else {
      router.replace('/home');
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrapper}>
            <BrieflyLogo width={140} height={48} />
          </View>
          <View style={styles.successCard}>
            <Ionicons name="mail-open-outline" size={48} color={theme.success} />
            <Text style={styles.successTitle}>Revisa tu correo</Text>
            <Text style={styles.successSubtitle}>
              Te enviamos un enlace para confirmar tu cuenta. Revisa tu bandeja de entrada y spam.
            </Text>
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.backBtn}>
                <Text style={styles.backBtnText}>Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </View>
    );
  }

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
        <Text style={styles.title}>Crea tu cuenta</Text>
        <Text style={styles.subtitle}>Únete a Briefly y estudia mejor</Text>

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
              <Text style={styles.googleBtnText}>Crear cuenta con Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o continúa con email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Name input */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Nombre visible</Text>
          <TextInput
            style={styles.input}
            placeholder="Ej. Juan Pérez"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="words"
            textContentType="name"
            returnKeyType="next"
            value={name}
            onChangeText={(t) => { setName(t); setError(null); }}
            editable={!submitting && !authLoading}
          />
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
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor={theme.textMuted}
              secureTextEntry={!showPassword}
              textContentType="newPassword"
              returnKeyType="next"
              value={password}
              onChangeText={(t) => { setPassword(t); setError(null); }}
              editable={!submitting && !authLoading}
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

        {/* Confirm password input */}
        <View style={styles.inputWrapper}>
          <Text style={styles.inputLabel}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Repite tu contraseña"
            placeholderTextColor={theme.textMuted}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            returnKeyType="done"
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setError(null); }}
            editable={!submitting && !authLoading}
            onSubmitEditing={handleRegister}
          />
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
          onPress={handleRegister}
          disabled={submitting || authLoading}
          activeOpacity={0.8}
        >
          {submitting || authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaBtnText}>Crear cuenta</Text>
          )}
        </TouchableOpacity>

        {/* Terms */}
        <Text style={styles.termsText}>
          Al crear una cuenta aceptas nuestros términos y política de privacidad.
        </Text>

        {/* Link */}
        <View style={styles.linksRow}>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkBold}>Iniciar sesión</Text></Text>
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
    marginBottom: 16,
  },
  ctaBtnDisabled: {
    opacity: 0.6,
  },
  ctaBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  termsText: {
    fontSize: 11,
    color: theme.textMuted,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
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
  // Success state
  successCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  backBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backBtnText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },
});