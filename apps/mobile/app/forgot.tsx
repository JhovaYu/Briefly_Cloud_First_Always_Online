import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/services/AuthContext';
import { BrieflyLogo } from '../src/components/ui/BrieflyLogo';
import { tokens } from '../src/theme/tokens';

const theme = tokens.dark;

export default function ForgotScreen() {
  const { resetPassword, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!email.trim()) return;
    setSubmitting(true);
    setError(null);

    const { error: err } = await resetPassword(email.trim());

    setSubmitting(false);
    if (err) {
      const msg = err.message ?? '';
      if (
        msg.toLowerCase().includes('network') ||
        msg.toLowerCase().includes('fetch')
      ) {
        setError('Sin conexión. Verifica tu internet e inténtalo de nuevo');
      } else {
        setError('No pudimos enviar el enlace. Intenta nuevamente');
      }
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoWrapper}>
            <BrieflyLogo width={140} height={48} />
          </View>
          <View style={styles.infoCard}>
            <Ionicons name="checkmark-circle" size={48} color={theme.success} />
            <Text style={styles.infoTitle}>Enlace enviado</Text>
            <Text style={styles.infoSubtitle}>
              Revisa tu bandeja de entrada y spam.
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
        <Text style={styles.title}>Recupera tu acceso</Text>
        <Text style={styles.subtitle}>Te enviaremos un enlace a tu correo</Text>

        {/* Info card */}
        <View style={styles.preInfoCard}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={styles.preInfoText}>
            Si tu cuenta existe, recibirás un enlace para restablecer tu contraseña.
          </Text>
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
            returnKeyType="done"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            editable={!submitting && !authLoading}
            onSubmitEditing={handleReset}
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
          onPress={handleReset}
          disabled={submitting || authLoading}
          activeOpacity={0.8}
        >
          {submitting || authLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaBtnText}>Enviar enlace de recuperación</Text>
          )}
        </TouchableOpacity>

        {/* Link */}
        <View style={styles.linksRow}>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text style={styles.linkText}>Volver al inicio de sesión</Text>
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
    marginBottom: 24,
  },
  preInfoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  preInfoText: {
    fontSize: 13,
    color: theme.textSecondary,
    flex: 1,
    lineHeight: 20,
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
    color: theme.primary,
    fontWeight: '600',
  },
  // Success state
  infoCard: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  infoTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.text,
    marginTop: 20,
    marginBottom: 12,
  },
  infoSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
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