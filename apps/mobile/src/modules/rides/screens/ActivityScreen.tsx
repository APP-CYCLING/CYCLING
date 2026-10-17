import { ActivityDetail } from "../components/ActivityDetail";
import { BrandLogo } from "../../../shared/components/BrandLogo";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../auth/context/AuthContext";
import { useRideHistory } from "../hooks/useRideHistory";
import { ActivityChart } from "../components/ActivityChart";
import { ActivityRideCard } from "../components/ActivityRideCard";
import {
  durationLabel,
  filterRides,
  rideDayLabel,
  summarizeRides,
  type ActivityPeriod,
} from "../utils/activity-summary";
import {
  AppText,
  Chip,
  IconButton,
  ScreenHeader,
  SectionHeading,
} from "../../../shared/components/DesignSystem";
import {
  Busy,
  H1,
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
export default function ActivityScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const { user } = useAuth(),
    history = useRideHistory();
  const [period, setPeriod] = useState<ActivityPeriod>("week"),
    [mapId, setMapId] = useState<string | null>(null),
    [detailId, setDetailId] = useState<string | null>(null),
    [visibleCount, setVisibleCount] = useState(6),
    [shareError, setShareError] = useState("");
  const rides = filterRides(history.rides, period),
    summary = summarizeRides(rides),
    selected = history.rides.find((ride) => ride.id === detailId);
  const maxDistance = Math.max(
    0,
    ...history.rides.map((ride) => ride.distanceKm),
  );
  const mapRide = rides.some((ride) => ride.id === mapId)
    ? mapId
    : rides.find((ride) => ride.coordinates.length >= 1 || !!ride.plannedRoute)
        ?.id;
  const share = async () => {
    try {
      const weekly = summarizeRides(filterRides(history.rides, "week"));
      await Share.share({
        message: `Mi semana en CYCLING 🚲\n${weekly.distanceKm.toFixed(1)} km · ${weekly.count} salidas · ${durationLabel(weekly.durationSec)}\n¡Mi ciudad, a mi ritmo!`,
      });
    } catch {
      setShareError("No se pudo abrir el menú para compartir.");
    }
  };
  const periods: { value: ActivityPeriod; label: string }[] = [
    { value: "week", label: "Esta semana" },
    { value: "month", label: "Mes actual" },
    { value: "year", label: `Año ${new Date().getFullYear()}` },
    { value: "all", label: "Todo el historial" },
  ];
  const summaryMetrics = [
    [String(summary.count), "Salidas registradas", "bicycle-outline" as const],
    [
      durationLabel(summary.durationSec),
      "Tiempo en pedales",
      "time-outline" as const,
    ],
    [
      summary.averageKmh.toFixed(1),
      "km/h · Promedio",
      "speedometer-outline" as const,
    ],
  ] as const;
  return (
    <View style={s.screen}>
      <ScreenHeader title="Actividad" />
      <Page>
        <View style={s.row}>
          <View style={s.dot} />
          <AppText style={{ fontSize: 10, letterSpacing: 1 }}>
            {user?.name.toUpperCase() || "TU HISTORIA EN BICICLETA"}
          </AppText>
        </View>
        <H1>Mi actividad</H1>
        {!user ? (
          <>
            <Notice message="Inicia sesión para guardar y consultar tus recorridos." />
            <PrimaryButton
              title="Iniciar sesión"
              onPress={() => router.push("/auth")}
            />
          </>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 12 }}
            >
              {periods.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  active={period === item.value}
                  onPress={() => {
                    setPeriod(item.value);
                    setVisibleCount(6);
                  }}
                />
              ))}
            </ScrollView>
            <View style={s.row}>
              <Chip
                icon="bicycle-outline"
                label="Todos los recorridos"
                active
              />
              <AppText style={{ color: colors.muted, fontSize: 10, flex: 1 }}>
                Registro GPS
              </AppText>
            </View>
            {history.loading ? (
              <Busy />
            ) : history.error ? (
              <>
                <Notice message={history.error} />
                <PrimaryButton title="Reintentar" onPress={history.refresh} />
              </>
            ) : (
              <>
                <Panel style={{ marginTop: 10, gap: 18 }}>
                  <AppText style={s.label}>DISTANCIA TOTAL</AppText>
                  <View style={[s.row, { alignItems: "baseline" }]}>
                    <AppText
                      weight="heavy"
                      style={{ fontSize: 45, letterSpacing: -2 }}
                    >
                      {summary.distanceKm.toFixed(1)}
                    </AppText>
                    <AppText weight="bold" style={{ color: colors.greenDark }}>
                      km
                    </AppText>
                  </View>
                  <View style={s.summary}>
                    {summaryMetrics.map(([value, label, icon]) => (
                      <View
                        key={label}
                        style={{ flex: 1, alignItems: "center", gap: 7 }}
                      >
                        <Ionicons name={icon} size={17} color={colors.muted} />
                        <AppText
                          weight="bold"
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          style={{ fontSize: 18 }}
                        >
                          {value}
                        </AppText>
                        <AppText
                          style={{
                            fontSize: 9,
                            color: colors.muted,
                            textAlign: "center",
                          }}
                        >
                          {label}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </Panel>
                <ActivityChart rides={history.rides} />
                <SectionHeading title="Historial de salidas" />
                {history.rides.length === 100 && (
                  <AppText style={s.caption}>
                    Resumen limitado a las últimas 100 actividades cargadas.
                  </AppText>
                )}
                {rides.length ? (
                  rides.slice(0, visibleCount).map((ride, index) => (
                    <View key={ride.id} style={{ gap: 12, marginBottom: 16 }}>
                      {index === 0 ||
                      new Date(ride.startedAt).toDateString() !==
                        new Date(rides[index - 1].startedAt).toDateString() ? (
                        <View style={s.row}>
                          <View style={s.dot} />
                          <AppText weight="medium" style={s.day}>
                            {rideDayLabel(ride.startedAt)}
                          </AppText>
                        </View>
                      ) : null}
                      <ActivityRideCard
                        ride={ride}
                        showMap={mapRide === ride.id && !selected}
                        onMap={() =>
                          ride.coordinates.length >= 1 || !!ride.plannedRoute
                            ? setMapId(ride.id)
                            : setDetailId(ride.id)
                        }
                        onDetail={() => setDetailId(ride.id)}
                        record={
                          ride.distanceKm > 0 && ride.distanceKm === maxDistance
                        }
                      />
                    </View>
                  ))
                ) : (
                  <>
                    <BrandLogo variant="emblem" width={48} />
                    <Notice message="No hay recorridos guardados en este período. ¡Tu próxima salida te espera!" />
                    <PrimaryButton
                      title="Iniciar recorrido →"
                      onPress={() => router.push("/ride")}
                    />
                  </>
                )}
                {rides.length > visibleCount && (
                  <PrimaryButton
                    title={`Ver más salidas (${rides.length - visibleCount})`}
                    outline
                    onPress={() => setVisibleCount((count) => count + 6)}
                  />
                )}
                {!!shareError && <Notice message={shareError} />}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void share()}
                  style={s.share}
                >
                  <Ionicons
                    name="share-outline"
                    size={20}
                    color={colors.green}
                  />
                  <AppText weight="bold" style={{ color: colors.green }}>
                    Compartir resumen semanal
                  </AppText>
                </Pressable>
                <PrimaryButton
                  title="Actualizar mis actividades"
                  outline
                  onPress={history.refresh}
                />
              </>
            )}
          </>
        )}
      </Page>
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setDetailId(null)}
      >
        <SafeAreaView style={s.screen}>
          <View style={s.modalHeader}>
            <IconButton
              icon="close"
              label="Cerrar detalle"
              onPress={() => setDetailId(null)}
            />
            <AppText weight="bold" style={{ fontSize: 18 }}>
              Detalle del recorrido
            </AppText>
          </View>
          {selected && (
            <ScrollView
              contentContainerStyle={{
                padding: 20,
                gap: 18,
                paddingBottom: 32,
              }}
            >
              <ActivityDetail
                key={selected.id}
                ride={selected}
                onClose={() => setDetailId(null)}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    row: { flexDirection: "row", alignItems: "center", gap: 7 },
    dot: {
      backgroundColor: colors.greenDark,
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    label: { color: colors.muted, letterSpacing: 0.8, fontSize: 10 },
    summary: {
      borderRadius: 17,
      backgroundColor: colors.surfaceLow,
      padding: 15,
      flexDirection: "row",
      gap: 10,
    },
    caption: { fontSize: 12, color: colors.muted, lineHeight: 19 },
    day: {
      fontSize: 11,
      color: colors.muted,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    share: {
      backgroundColor: colors.black,
      borderRadius: 28,
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 9,
      paddingHorizontal: 14,
    },
    modalHeader: {
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
    },
  });
