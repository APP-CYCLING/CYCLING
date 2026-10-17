import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/context/AuthContext";
import { useCyclingProfile } from "../hooks/useCyclingProfile";
import { profileService } from "../services/profile.service";
import {
  disciplines,
  frequencies,
  validateProfile,
  type CyclingProfile,
} from "../utils/profile-model";
import { ProfileField, ProfileSectionTitle } from "../components/ProfileUI";
import {
  AppText,
  Avatar,
  Chip,
  IconButton,
} from "../../../shared/components/DesignSystem";
import {
  Busy,
  Notice,
  Panel,
  PrimaryButton,
} from "../../../shared/components/UI";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
export default function EditProfileScreen() {
  const { user } = useAuth();
  return <Editor key={user?.id ?? "guest"} />;
}
function Editor() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const { user } = useAuth(),
    remote = useCyclingProfile();
  const [draft, setDraft] = useState<CyclingProfile | null>(null),
    [baseline, setBaseline] = useState(""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const mounted = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (remote.profile && !draft) {
      setDraft(remote.profile);
      setBaseline(JSON.stringify(remote.profile));
    }
  }, [remote.profile, draft]);
  const goBack = () =>
    router.canGoBack() ? router.back() : router.replace("/profile");
  const leave = () => {
    if (saving) return;
    if (draft && JSON.stringify(draft) !== baseline)
      Alert.alert(
        "¿Descartar cambios?",
        "Tus cambios todavía no se han guardado.",
        [
          { text: "Seguir editando", style: "cancel" },
          {
            text: "Descartar",
            style: "destructive",
            onPress: goBack,
          },
        ],
      );
    else goBack();
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        leave();
        return true;
      },
    );
    return () => subscription.remove();
  }, [draft, baseline, saving]);
  const change = <K extends keyof CyclingProfile>(
    key: K,
    value: CyclingProfile[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError("");
  };
  const save = async () => {
    if (!user || !draft || inFlight.current) return;
    setError("");
    try {
      const valid = validateProfile(draft);
      inFlight.current = true;
      setSaving(true);
      const updated = await profileService.update(user.id, valid);
      if (mounted.current) {
        setDraft(updated);
        setBaseline(JSON.stringify(updated));
        Alert.alert("Perfil actualizado", "Tus cambios se guardaron.", [
          { text: "Continuar", onPress: goBack },
        ]);
      }
    } catch (e: unknown) {
      if (mounted.current)
        setError(
          e instanceof Error ? e.message : "No se pudo guardar el perfil.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          <IconButton
            icon="arrow-back"
            label="Volver sin guardar"
            onPress={leave}
          />
          <AppText weight="bold" style={{ fontSize: 18, flex: 1 }}>
            Editar perfil
          </AppText>
          <Pressable
            accessibilityRole="button"
            disabled={saving || !draft || !user}
            onPress={() => void save()}
            style={[s.save, (saving || !draft) && { opacity: 0.5 }]}
          >
            <Ionicons name="checkmark" size={18} color={colors.text} />
            <AppText weight="bold" style={{ fontSize: 12 }}>
              {saving ? "Guardando…" : "Guardar"}
            </AppText>
          </Pressable>
        </View>
        {!user ? (
          <View style={{ padding: 20, gap: 16 }}>
            <Notice message="Inicia sesión para editar tu perfil." />
            <PrimaryButton
              title="Iniciar sesión"
              onPress={() => router.replace("/auth")}
            />
          </View>
        ) : remote.loading && !draft ? (
          <Busy />
        ) : remote.error && !draft ? (
          <View style={{ padding: 20, gap: 12 }}>
            <Notice message={remote.error} />
            <PrimaryButton title="Reintentar" onPress={remote.refresh} />
          </View>
        ) : (
          draft && (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.content}
            >
              <View style={s.identityHero}>
                <ImageBackground
                  source={require("../../../../assets/images/stitch/profile-cover.jpg")}
                  style={s.cover}
                  imageStyle={{ borderRadius: 18 }}
                  accessibilityLabel="Portada ilustrativa de ciclismo"
                />
                <View
                  style={{
                    alignSelf: "center",
                    marginTop: -38,
                    borderWidth: 4,
                    borderRadius: 46,
                    borderColor: colors.surfaceLow,
                  }}
                >
                  <Avatar name={draft.name} large />
                </View>
                <View style={{ alignItems: "center", paddingBottom: 4 }}>
                  <Chip
                    icon="bicycle-outline"
                    label="Tu identidad ciclista"
                    active
                  />
                </View>
              </View>
              <ProfileSectionTitle
                icon="person-outline"
                title="Identidad ciclista"
              />
              <Panel style={{ gap: 18 }}>
                <ProfileField
                  label="Nombre y apellido"
                  value={draft.name}
                  maxLength={80}
                  editable={!saving}
                  autoComplete="name"
                  onChangeText={(value) => change("name", value)}
                />
                <ProfileField
                  label="Alias"
                  value={draft.username}
                  placeholder="Tu alias en CYCLING"
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                  onChangeText={(value) => change("username", value)}
                />
                <AppText style={s.hint}>
                  El alias es descriptivo; no reserva un nombre de usuario
                  único.
                </AppText>
                <ProfileField
                  label="Ubicación principal"
                  value={draft.location}
                  placeholder="Ciudad, país"
                  maxLength={100}
                  editable={!saving}
                  onChangeText={(value) => change("location", value)}
                />
                <ProfileField
                  label={`Biografía · ${draft.bio.length} / 160`}
                  value={draft.bio}
                  placeholder="Cuéntanos cómo disfrutas la bicicleta"
                  multiline
                  maxLength={160}
                  editable={!saving}
                  onChangeText={(value) => change("bio", value)}
                />
              </Panel>
              <ProfileSectionTitle
                icon="speedometer-outline"
                title="Métricas y preferencias"
              />
              <Panel style={{ gap: 18 }}>
                <AppText style={{ fontSize: 12 }}>
                  Modalidad de pedaleo preferida
                </AppText>
                <View style={s.chips}>
                  {disciplines.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      active={draft.discipline === value}
                      onPress={
                        saving ? undefined : () => change("discipline", value)
                      }
                    />
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <ProfileField
                    label="Peso corporal (opcional)"
                    suffix="kg"
                    value={draft.weightKg}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    editable={!saving}
                    onChangeText={(value) => change("weightKg", value)}
                  />
                  <ProfileField
                    label="Estatura (opcional)"
                    suffix="cm"
                    value={draft.heightCm}
                    keyboardType="decimal-pad"
                    maxLength={6}
                    editable={!saving}
                    onChangeText={(value) => change("heightCm", value)}
                  />
                </View>
                <AppText style={s.hint}>
                  Estos datos se guardan en tu cuenta. Todavía no se usan para
                  estimar calorías.
                </AppText>
                <AppText style={{ fontSize: 12 }}>
                  Frecuencia semanal habitual
                </AppText>
                <View style={s.chips}>
                  {frequencies.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      active={draft.frequency === value}
                      onPress={
                        saving ? undefined : () => change("frequency", value)
                      }
                    />
                  ))}
                </View>
                <ProfileField
                  label="Objetivo mensual de distancia"
                  suffix="km"
                  value={draft.monthlyGoalKm}
                  keyboardType="decimal-pad"
                  maxLength={8}
                  editable={!saving}
                  onChangeText={(value) => change("monthlyGoalKm", value)}
                />
              </Panel>
              <ProfileSectionTitle
                icon="bicycle-outline"
                title="Garaje virtual"
                hint="Bicicleta principal"
              />
              <Panel style={{ gap: 18 }}>
                <ProfileField
                  label="Nombre de tu bicicleta"
                  value={draft.bikeName}
                  placeholder="Marca y modelo"
                  maxLength={80}
                  editable={!saving}
                  onChangeText={(value) => change("bikeName", value)}
                />
                <ProfileField
                  label="Tipo de bicicleta"
                  value={draft.bikeType}
                  placeholder="Urbana, gravel, carretera…"
                  maxLength={60}
                  editable={!saving}
                  onChangeText={(value) => change("bikeType", value)}
                />
              </Panel>
              <ProfileSectionTitle
                icon="shield-checkmark-outline"
                title="Privacidad y rutas seguras"
              />
              <Panel>
                <AppText weight="bold">Tus actividades son privadas</AppText>
                <AppText style={s.hint}>
                  Solo tu cuenta puede consultar tus recorridos en la app. Las
                  zonas de exclusión de inicio y fin y los perfiles públicos
                  todavía no están disponibles.
                </AppText>
                <AppText style={s.hint}>
                  La foto de perfil y la gestión de varias bicicletas se
                  incorporarán en una siguiente versión.
                </AppText>
              </Panel>
              {!!error && <Notice message={error} />}
              <PrimaryButton
                title={saving ? "Guardando cambios…" : "Guardar cambios"}
                disabled={saving}
                onPress={() => void save()}
              />
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={leave}
                style={{
                  minHeight: 48,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AppText style={{ color: colors.muted }}>
                  Descartar y volver
                </AppText>
              </Pressable>
            </ScrollView>
          )
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 16,
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    save: {
      borderRadius: 24,
      backgroundColor: colors.green,
      flexDirection: "row",
      gap: 5,
      minHeight: 44,
      paddingHorizontal: 14,
      alignItems: "center",
    },
    content: {
      padding: 16,
      paddingBottom: 32,
      gap: 10,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    identityHero: {
      padding: 14,
      borderRadius: 24,
      backgroundColor: colors.surfaceLow,
      gap: 8,
    },
    cover: { height: 104, width: "100%" },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  });
