import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { CyclingRoute } from "@cycling/contracts";
import { useAuth } from "../../auth/context/AuthContext";
import { useRideHistory } from "../../rides/hooks/useRideHistory";
import { RideCard } from "../../rides/components/RideCard";
import { routesService } from "../../routes/services/routes.service";
import { RouteCard } from "../../routes/components/RouteCard";
import {
  AppText,
  ScreenHeader,
  SectionHeading,
  MetricTile,
} from "../../../shared/components/DesignSystem";
import {
  Page,
  H1,
  Subtitle,
  Busy,
  Notice,
  PrimaryButton,
} from "../../../shared/components/UI";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
export default function HomeScreen() {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const { user } = useAuth(),
    history = useRideHistory(),
    { width } = useWindowDimensions();
  const [routes, setRoutes] = useState<CyclingRoute[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void routesService
      .list()
      .then((data) => {
        if (current) setRoutes(data);
      })
      .catch((e: unknown) => {
        if (current)
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar las rutas.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [attempt]);
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekly = history.rides.filter(
    (ride) => new Date(ride.startedAt) >= monday,
  );
  const km = weekly.reduce((sum, ride) => sum + ride.distanceKm, 0),
    minutes = weekly.reduce((sum, ride) => sum + ride.durationSec, 0) / 60;
  return (
    <View style={s.screen}>
      <ScreenHeader title="Tu ciudad, a tu ritmo" />
      <Page>
        <H1>
          {user
            ? `¡Buen día, ${user.name.split(" ")[0]}!`
            : "¡Hoy se sale a rodar!"}
        </H1>
        <Subtitle>Tu próxima aventura empieza con un pedal.</Subtitle>
        <View style={[s.actions, width < 350 && { flexDirection: "column" }]}>
          {[
            {
              title: "Planificar ruta",
              desc: "Encuentra tu camino",
              icon: "map-outline" as const,
              path: "/explore" as const,
              dark: false,
            },
            {
              title: "Iniciar recorrido",
              desc: "Con tu GPS en vivo",
              icon: "bicycle-outline" as const,
              path: "/ride" as const,
              dark: true,
            },
          ].map((action) => (
            <Pressable
              accessibilityRole="button"
              key={action.title}
              onPress={() => router.push(action.path)}
              style={[
                s.action,
                { backgroundColor: action.dark ? colors.black : colors.green },
              ]}
            >
              <View style={s.actionTop}>
                <View
                  style={[
                    s.actionIcon,
                    action.dark && { backgroundColor: "#303B2A" },
                  ]}
                >
                  <Ionicons
                    name={action.icon}
                    size={23}
                    color={action.dark ? colors.green : colors.black}
                  />
                </View>
                <Ionicons
                  name="arrow-forward"
                  size={19}
                  color={action.dark ? colors.white : colors.black}
                />
              </View>
              <AppText
                weight="heavy"
                style={{
                  color: action.dark ? colors.white : colors.black,
                  fontSize: 18,
                }}
              >
                {action.title}
              </AppText>
              <AppText
                style={{
                  fontSize: 11,
                  color: action.dark ? "#C4CDC0" : "#364F25",
                }}
              >
                {action.desc}
              </AppText>
            </Pressable>
          ))}
        </View>
        <SectionHeading title="Rendimiento semanal" />
        {!user ? (
          <Notice message="Inicia sesión para ver tus kilómetros y actividades." />
        ) : history.loading ? (
          <Busy />
        ) : history.error ? (
          <>
            <Notice message={history.error} />
            <PrimaryButton
              title="Reintentar actividad"
              outline
              onPress={history.refresh}
            />
          </>
        ) : (
          <>
            <View style={s.row}>
              <MetricTile
                icon="navigate-outline"
                value={km.toFixed(1)}
                label="KILÓMETROS"
              />
              <MetricTile
                icon="time-outline"
                value={`${Math.round(minutes)}`}
                label="MINUTOS"
              />
              <MetricTile
                icon="bicycle-outline"
                value={`${weekly.length}`}
                label="RECORRIDOS"
              />
            </View>
            {history.rides.length === 100 && (
              <Subtitle>
                Resumen de las últimas 100 actividades cargadas.
              </Subtitle>
            )}
          </>
        )}
        <SectionHeading
          title="Rutas para explorar"
          action="Ver mapa"
          onPress={() => router.push("/explore")}
        />
        {loading ? (
          <Busy />
        ) : error ? (
          <>
            <Notice message={error} />
            <PrimaryButton
              title="Reintentar rutas"
              outline
              onPress={() => setAttempt((value) => value + 1)}
            />
          </>
        ) : routes.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 14, paddingBottom: 4 }}
          >
            {routes.slice(0, 6).map((route, index) => (
              <View key={route.id} style={{ width: Math.min(width - 64, 310) }}>
                <RouteCard route={route} coverIndex={index} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Notice message="Todavía no hay rutas publicadas. Puedes planificar la tuya en Explorar." />
        )}
        <SectionHeading
          title="Últimos recorridos"
          action="Ver todos"
          onPress={() => router.push("/activity")}
        />
        {history.loading ? (
          <Busy />
        ) : history.error ? (
          <Notice message={history.error} />
        ) : history.rides.length ? (
          history.rides
            .slice(0, 2)
            .map((ride) => <RideCard key={ride.id} ride={ride} />)
        ) : (
          <>
            <Notice message="Cada kilómetro cuenta. Registra tu primer recorrido." />
            <PrimaryButton
              title="Empezar a pedalear →"
              onPress={() => router.push("/ride")}
            />
          </>
        )}
      </Page>
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    row: { flexDirection: "row", gap: 8 },
    actions: { flexDirection: "row", gap: 12, marginTop: 20 },
    action: { flex: 1, borderRadius: 24, padding: 18, gap: 10 },
    actionTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#C8F29E",
      justifyContent: "center",
      alignItems: "center",
    },
  });
