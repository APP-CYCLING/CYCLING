import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthForm } from "../hooks/useAuthForm";
import { AuthInput } from "../components/AuthInput";
import {
  AuthFeedback,
  AuthHeader,
  LegalNotice,
  RememberEmail,
  SocialOptions,
} from "../components/AuthChrome";
import { AppText } from "../../../shared/components/DesignSystem";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
export default function AuthScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const form = useAuthForm(),
    creating = form.mode === "register";
  const emailRef = useRef<TextInput>(null),
    passwordRef = useRef<TextInput>(null),
    scroll = useRef<ScrollView>(null);
  useEffect(() => {
    Keyboard.dismiss();
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [form.mode]);
  const submit = () => {
    Keyboard.dismiss();
    void form.submit();
  };
  return (
    <SafeAreaView style={s.screen}>
      <AuthHeader onBack={form.leave} busy={form.busy} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroll}
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 8, marginBottom: creating ? 4 : 12 }}>
            <AppText accessibilityRole="header" weight="heavy" style={s.title}>
              {creating ? "Crea tu cuenta" : "Iniciar sesión"}
            </AppText>
            <AppText style={s.subtitle}>
              {creating
                ? "Empieza a rodar por las mejores ciclovías."
                : "Ingresa tus datos para continuar pedaleando."}
            </AppText>
          </View>
          {!!form.success && <AuthFeedback message={form.success} />}
          {!!form.error && <AuthFeedback message={form.error} error />}
          {!!form.storageNotice && (
            <AuthFeedback message={form.storageNotice} />
          )}
          {creating && (
            <AuthInput
              label="Nombre y apellido"
              icon="person-outline"
              value={form.name}
              onChangeText={(value) => form.update("name", value)}
              error={form.fieldErrors.name}
              placeholder="Ej. Camila Valdivia"
              autoComplete="name"
              textContentType="name"
              autoCapitalize="words"
              maxLength={80}
              editable={!form.busy}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
          <AuthInput
            label="Correo electrónico"
            icon="at-outline"
            inputRef={emailRef}
            value={form.email}
            onChangeText={(value) => form.update("email", value)}
            error={form.fieldErrors.email}
            placeholder={creating ? "ciclista@ejemplo.com" : "tu@email.com"}
            autoComplete="email"
            textContentType="emailAddress"
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={254}
            editable={!form.busy}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />
          <AuthInput
            key={`password-${form.mode}`}
            label="Contraseña"
            icon="lock-closed-outline"
            inputRef={passwordRef}
            password
            value={form.password}
            onChangeText={(value) => form.update("password", value)}
            error={form.fieldErrors.password}
            placeholder={creating ? "Mínimo 8 caracteres" : "Tu contraseña"}
            autoComplete={creating ? "new-password" : "current-password"}
            textContentType={creating ? "newPassword" : "password"}
            autoCorrect={false}
            autoCapitalize="none"
            editable={!form.busy}
            returnKeyType="go"
            onSubmitEditing={submit}
            labelAction={
              !creating ? (
                <AppText
                  accessibilityLabel="Recuperación de contraseña: próximamente"
                  style={{ color: colors.muted, fontSize: 10 }}
                >
                  Recuperar contraseña · próximamente
                </AppText>
              ) : undefined
            }
          />
          {!creating && (
            <RememberEmail
              checked={form.remember}
              disabled={form.busy}
              onPress={form.toggleRemember}
            />
          )}
          {creating && (
            <View style={s.registrationNote}>
              <Ionicons
                name="shield-checkmark-outline"
                size={21}
                color={colors.greenDark}
              />
              <AppText
                style={{
                  flex: 1,
                  color: colors.muted,
                  fontSize: 12,
                  lineHeight: 18,
                }}
              >
                Crea tu cuenta para guardar tus recorridos y seguir tu progreso.
              </AppText>
            </View>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: form.busy, busy: form.busy }}
            disabled={form.busy}
            onPress={submit}
            style={({ pressed }) => [
              s.submit,
              (pressed || form.busy) && { opacity: 0.65 },
            ]}
          >
            {form.busy && (
              <ActivityIndicator size="small" color={colors.black} />
            )}
            <AppText
              weight="bold"
              style={{ fontSize: 15, color: colors.black }}
            >
              {form.busy
                ? creating
                  ? "Creando cuenta…"
                  : "Iniciando sesión…"
                : creating
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
            </AppText>
            {!creating && !form.busy && (
              <Ionicons name="arrow-forward" size={21} color={colors.black} />
            )}
          </Pressable>
          <View style={{ marginTop: 7 }}>
            <SocialOptions register={creating} />
          </View>
          <View style={s.switchRow}>
            <AppText style={{ color: colors.muted, fontSize: 13 }}>
              {creating ? "¿Ya eres miembro?" : "¿No tienes una cuenta aún?"}
            </AppText>
            <Pressable
              accessibilityRole="button"
              disabled={form.busy}
              onPress={form.switchMode}
              style={s.switchButton}
            >
              <AppText
                weight="bold"
                style={{ color: colors.greenDark, fontSize: 14 }}
              >
                {creating ? "Iniciar sesión" : "Registrarme"}
              </AppText>
            </Pressable>
          </View>
          <LegalNotice />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 30,
      gap: 18,
      width: "100%",
      maxWidth: 512,
      alignSelf: "center",
    },
    title: {
      fontSize: 27,
      lineHeight: 34,
      letterSpacing: -0.8,
      color: colors.text,
    },
    subtitle: { fontSize: 14, lineHeight: 22, color: colors.muted },
    registrationNote: {
      paddingVertical: 4,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    submit: {
      minHeight: 56,
      paddingVertical: 14,
      paddingHorizontal: 18,
      marginTop: 4,
      backgroundColor: colors.green,
      borderRadius: 30,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      boxShadow: "0px 3px 7px #15191512",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      flexWrap: "wrap",
      columnGap: 6,
    },
    switchButton: {
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
  });
