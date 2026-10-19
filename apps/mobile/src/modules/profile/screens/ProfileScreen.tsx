import { rideDisplayName } from "../../rides/utils/ride-name";
import React, { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/context/AuthContext";
import { useRideHistory } from "../../rides/hooks/useRideHistory";
import {
  durationLabel,
  filterRides,
  summarizeRides,
} from "../../rides/utils/activity-summary";
import { useCyclingProfile } from "../hooks/useCyclingProfile";
import { SettingsRow } from "../components/ProfileUI";
import { ThemeSettingsRow } from "../../../shared/components/ThemeSettingsRow";
import {
  AppText,
  Avatar,
  Chip,
  IconButton,
  ScreenHeader,
  SectionHeading,
} from "../../../shared/components/DesignSystem";
import {
  Busy,
  Notice,
  Page,
  Panel,
  PrimaryButton,
} from "../../../shared/components/UI";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
import { useProfileMedia } from "../hooks/useProfileMedia";
export default function ProfileScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const { user, logout } = useAuth(),
    history = useRideHistory(),
    remote = useCyclingProfile();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const profile = remote.profile,
    summary = summarizeRides(history.rides),
    monthly = summarizeRides(filterRides(history.rides, "month"));
  const media = useProfileMedia(profile);
  const goal =
    Number(profile?.monthlyGoalKm) > 0 ? Number(profile?.monthlyGoalKm) : 250;
  const progress = Math.min(1, monthly.distanceKm / goal);
  const signOut = async () => {
    setBusy(true);
    setError("");
    try {
      await logout();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar la sesión.");
    } finally {
      setBusy(false);
    }
  };
  const edit = () => router.push(user ? "/edit-profile" : "/auth");
  const share = async () => {
    try {
      await Share.share({
        message: `${user?.name || "Ciclista"} en CYCLING · ${summary.distanceKm.toFixed(1)} km y ${summary.count} recorridos en mi historial cargado. ¡Mi ciudad, a mi ritmo!`,
      });
    } catch {
      setError("No se pudo abrir el menú para compartir.");
    }
  };
  const badges = [
    {
      icon: "flag-outline" as const,
      title: "Primer pedal",
      desc: "Tu primera salida",
      earned: summary.count >= 1,
    },
    {
      icon: "navigate-outline" as const,
      title: "Explorador",
      desc: "50 km acumulados",
      earned: summary.distanceKm >= 50,
    },
    {
      icon: "sunny-outline" as const,
      title: "Madrugador",
      desc: "Una salida antes de 6:30",
      earned: history.rides.some((ride) => {
        const date = new Date(ride.startedAt);
        return date.getHours() * 60 + date.getMinutes() < 390;
      }),
    },
    {
      icon: "bicycle-outline" as const,
      title: "Constancia",
      desc: "10 salidas registradas",
      earned: summary.count >= 10,
    },
  ];
  return (
    <View style={s.screen}>
      <ScreenHeader title="Mi perfil" />
      <Page>
        <Panel style={{ gap: 16 }}>
          {!!media.coverUrl && (
            <Image
              source={{ uri: media.coverUrl }}
              accessibilityLabel="Tu portada de perfil"
              style={{ width: "100%", height: 150, borderRadius: 20 }}
            />
          )}
          <View style={s.identity}>
            <Avatar
              name={profile?.name || user?.name}
              large
              uri={media.avatarUrl}
            />
            <View style={{ flex: 1, gap: 5 }}>
              <AppText style={s.kicker}>
                {user ? "COMUNIDAD CYCLING" : "A TU RITMO"}
              </AppText>
              <AppText weight="heavy" style={{ fontSize: 23 }}>
                {profile?.name || user?.name || "Ciclista invitado"}
              </AppText>
              <View style={s.row}>
                <Ionicons
                  name="location-outline"
                  color={colors.muted}
                  size={14}
                />
                <AppText style={s.caption}>
                  {profile?.location ||
                    (user ? "Añade tu ciudad" : "Tu ciudad te espera")}
                </AppText>
              </View>
              {profile?.username && (
                <AppText style={s.caption}>@{profile.username}</AppText>
              )}
            </View>
            <IconButton
              icon="options-outline"
              label="Editar datos de mi cuenta"
              onPress={edit}
            />
          </View>
          {profile?.bio && (
            <AppText style={{ lineHeight: 20 }}>{profile.bio}</AppText>
          )}
          <View style={s.bike}>
            <View style={s.bikeIcon}>
              <Ionicons
                name="bicycle-outline"
                size={24}
                color={colors.greenDark}
              />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText style={s.kicker}>BICICLETA PRINCIPAL</AppText>
              <AppText weight="bold" numberOfLines={2}>
                {profile?.bikeName || "Añade tu bicicleta"}
              </AppText>
              {profile?.bikeType && (
                <AppText style={s.caption}>{profile.bikeType}</AppText>
              )}
            </View>
          </View>
          <View style={s.row}>
            <Pressable accessibilityRole="button" onPress={edit} style={s.edit}>
              <Ionicons name="pencil-outline" size={16} color={colors.text} />
              <AppText weight="bold" style={{ fontSize: 12 }}>
                {user ? "Editar perfil" : "Crear cuenta / iniciar sesión"}
              </AppText>
            </Pressable>
            {user && (
              <IconButton
                icon="share-social-outline"
                label="Compartir mi resumen ciclista"
                onPress={() => void share()}
              />
            )}
          </View>
          {remote.loading && (
            <AppText style={s.caption}>Cargando datos de perfil…</AppText>
          )}
          {!!remote.error && (
            <>
              <Notice message={remote.error} />
              <PrimaryButton
                title="Reintentar perfil"
                outline
                onPress={remote.refresh}
              />
            </>
          )}
        </Panel>
        {!!media.error && (
          <>
            <Notice message={media.error} />
            <PrimaryButton
              title="Actualizar imágenes"
              outline
              onPress={media.refresh}
            />
          </>
        )}
        {user && (
          <Panel style={{ gap: 10 }}>
            <AppText weight="bold" style={{ fontSize: 19 }}>
              Álbumes
            </AppText>
            <AppText style={s.caption}>
              Tus fotos y videos agrupados por salida o momento. También
              encontrarás las fotos de tus recorridos.
            </AppText>
            <PrimaryButton
              title="Abrir mis álbumes →"
              outline
              onPress={() => router.push("/albums")}
            />
          </Panel>
        )}
        {!user ? (
          <>
            <Notice message="Inicia sesión para guardar tus datos y consultar tu progreso." />
            <PrimaryButton
              title="Iniciar sesión"
              onPress={() => router.push("/auth")}
            />
          </>
        ) : history.loading ? (
          <Busy />
        ) : history.error ? (
          <>
            <Notice message={history.error} />
            <PrimaryButton
              title="Reintentar actividad"
              onPress={history.refresh}
            />
          </>
        ) : (
          <>
            <Panel style={{ marginTop: 6, gap: 18 }}>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <AppText style={s.kicker}>RENDIMIENTO HISTÓRICO</AppText>
                <Ionicons
                  name="checkmark-circle"
                  color={colors.greenDark}
                  size={16}
                />
              </View>
              <View style={s.row}>
                {[
                  [summary.distanceKm.toFixed(1), "Kilómetros"],
                  [durationLabel(summary.durationSec), "Tiempo en ruta"],
                  [String(summary.count), "Rutas hechas"],
                ].map(([value, label]) => (
                  <View key={label} style={{ flex: 1, gap: 7 }}>
                    <AppText
                      weight="heavy"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{ fontSize: 25 }}
                    >
                      {value}
                    </AppText>
                    <AppText style={s.caption}>{label}</AppText>
                  </View>
                ))}
              </View>
              <View style={s.bike}>
                <Ionicons
                  name="leaf-outline"
                  color={colors.greenDark}
                  size={25}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <AppText weight="bold">Cada salida cuenta</AppText>
                  <AppText style={s.caption}>
                    Resumen de tus últimos {history.rides.length} recorridos,
                    hasta 100.
                  </AppText>
                </View>
              </View>
            </Panel>
            <SectionHeading title="Logros e insignias" />
            <Panel>
              <View style={s.row}>
                <Ionicons
                  name="trophy-outline"
                  size={21}
                  color={colors.warning}
                />
                <AppText weight="bold" style={{ flex: 1, fontSize: 13 }}>
                  Tu objetivo de{" "}
                  {new Date().toLocaleDateString("es", { month: "long" })}
                </AppText>
                <AppText weight="bold" style={{ fontSize: 12 }}>
                  {monthly.distanceKm.toFixed(0)} / {goal} km
                </AppText>
              </View>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{
                  min: 0,
                  max: goal,
                  now: Math.min(goal, monthly.distanceKm),
                }}
                style={s.progress}
              >
                <View
                  style={{
                    backgroundColor: colors.green,
                    height: 8,
                    borderRadius: 4,
                    width: `${progress * 100}%`,
                  }}
                />
              </View>
              <View style={[s.row, { justifyContent: "space-between" }]}>
                <AppText style={s.caption}>
                  {Math.floor(progress * 100)}% completado
                </AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={edit}
                  style={{ minHeight: 44, justifyContent: "center" }}
                >
                  <AppText
                    weight="bold"
                    style={{ color: colors.greenDark, fontSize: 12 }}
                  >
                    Cambiar objetivo
                  </AppText>
                </Pressable>
              </View>
            </Panel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
            >
              {badges.map((badge) => (
                <View key={badge.title} style={s.badge}>
                  <View
                    style={[
                      s.badgeIcon,
                      badge.earned && { backgroundColor: colors.softGreen },
                    ]}
                  >
                    <Ionicons
                      name={badge.icon}
                      size={26}
                      color={badge.earned ? colors.greenDark : colors.muted}
                    />
                  </View>
                  <AppText weight="bold" style={{ fontSize: 12 }}>
                    {badge.title}
                  </AppText>
                  <AppText style={[s.caption, { textAlign: "center" }]}>
                    {badge.desc}
                  </AppText>
                  <AppText
                    style={{
                      fontSize: 10,
                      color: badge.earned ? colors.greenDark : colors.muted,
                    }}
                  >
                    {badge.earned ? "Conseguido" : "Por conseguir"}
                  </AppText>
                </View>
              ))}
            </ScrollView>
            <AppText style={s.caption}>
              Logros calculados a partir del historial cargado.
            </AppText>
            <SectionHeading
              title="Recorridos guardados"
              action="Ver todos"
              onPress={() => router.push("/activity")}
            />
            {history.rides.length ? (
              history.rides.slice(0, 2).map((ride) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver mi historial de recorridos"
                  key={ride.id}
                  onPress={() => router.push("/activity")}
                  style={s.savedRide}
                >
                  <View style={s.savedIcon}>
                    <Ionicons
                      name="trail-sign-outline"
                      color={colors.greenDark}
                      size={28}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText weight="bold">{rideDisplayName(ride)}</AppText>
                    <AppText style={s.caption}>
                      {ride.distanceKm.toFixed(1)} km ·{" "}
                      {durationLabel(ride.durationSec)}
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward-circle"
                    color={colors.greenDark}
                    size={28}
                  />
                </Pressable>
              ))
            ) : (
              <Notice message="Todavía no tienes recorridos guardados. Tu primera salida te espera." />
            )}
          </>
        )}
        <SectionHeading title="Configuración y seguridad" />
        <Panel style={{ gap: 0 }}>
          <ThemeSettingsRow />
          <SettingsRow
            icon="bicycle-outline"
            title="Mi bicicleta y preferencias"
            detail={profile?.bikeName || "Personaliza tu experiencia ciclista"}
            onPress={edit}
          />
          <SettingsRow
            icon="shield-checkmark-outline"
            title="Privacidad de mis recorridos"
            detail="Actividades vinculadas solo a tu cuenta"
            onPress={() =>
              Alert.alert(
                "Tus actividades son privadas",
                "El historial está protegido para que solo tu cuenta pueda consultarlo. Las zonas de exclusión de inicio y fin todavía no están implementadas.",
              )
            }
          />
          <SettingsRow
            icon="layers-outline"
            title="Mapas y ciclovías"
            detail="Unidades métricas · infraestructura OpenStreetMap"
            onPress={() => router.push("/explore")}
          />
          <SettingsRow
            icon="cloud-outline"
            title="Clima y calidad del aire"
            detail="Próximamente"
            pending
          />
        </Panel>
        {!!error && <Notice message={error} />}
        {user && (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void signOut()}
            style={s.logout}
          >
            <Ionicons name="log-out-outline" color={colors.danger} size={20} />
            <AppText weight="medium" style={{ color: colors.danger }}>
              {busy ? "Cerrando sesión…" : "Cerrar sesión en este dispositivo"}
            </AppText>
          </Pressable>
        )}
        <AppText
          style={[s.caption, { textAlign: "center", paddingVertical: 10 }]}
        >
          CYCLING · Tu ciudad, a tu ritmo
        </AppText>
      </Page>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    row: { flexDirection: "row", alignItems: "center", gap: 8 },
    identity: { flexDirection: "row", alignItems: "center", gap: 12 },
    kicker: { fontSize: 10, letterSpacing: 0.8, color: colors.muted },
    caption: { fontSize: 11, lineHeight: 16, color: colors.muted },
    bike: {
      backgroundColor: colors.surfaceLow,
      padding: 12,
      borderRadius: 16,
      flexDirection: "row",
      gap: 10,
      alignItems: "center",
    },
    bikeIcon: { backgroundColor: colors.surface, padding: 7, borderRadius: 10 },
    edit: {
      flex: 1,
      borderRadius: 25,
      backgroundColor: colors.surfaceLow,
      minHeight: 46,
      justifyContent: "center",
      alignItems: "center",
      flexDirection: "row",
      gap: 7,
    },
    progress: {
      height: 8,
      backgroundColor: colors.surfaceLow,
      borderRadius: 4,
      marginTop: 10,
    },
    badge: {
      borderRadius: 22,
      width: 132,
      padding: 14,
      backgroundColor: colors.surface,
      alignItems: "center",
      gap: 8,
    },
    badgeIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.surfaceLow,
      alignItems: "center",
      justifyContent: "center",
    },
    savedRide: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      padding: 14,
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    savedIcon: {
      width: 54,
      height: 54,
      borderRadius: 16,
      backgroundColor: colors.softGreen,
      justifyContent: "center",
      alignItems: "center",
    },
    logout: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      minHeight: 56,
      gap: 8,
      marginTop: 18,
    },
  });
