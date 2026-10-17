import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SaveRideDialog } from "./SaveRideDialog";
import { CyclingMap } from "../../maps/components/CyclingMap";
import type { useRideController } from "../hooks/useRideController";
import { canRecordFix } from "../../geolocation/utils/location-policy";
import {
  AppText,
  Chip,
  IconButton,
  MetricTile,
  ScreenHeader,
} from "../../../shared/components/DesignSystem";
import { Notice, PrimaryButton } from "../../../shared/components/UI";
import {
  useThemeColors,
  useThemedStyles,
} from "../../../shared/theme/ThemeContext";
import type { Palette } from "../../../shared/theme/colors";
import { useLiveNavigation } from "../../navigation/hooks/useLiveNavigation";
import { LiveNavigationPanel } from "../../navigation/components/LiveNavigationPanel";
import { distanceLabel } from "../../navigation/utils/live-navigation";
type Props = { controller: ReturnType<typeof useRideController> };
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor((seconds % 3600) / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
export function RideLayout({ controller: c }: Props) {
  const colors = useThemeColors();
  const s = useThemedStyles(createStyles);

  const [mapMode, setMapMode] = useState(false),
    { width, height } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [bannerHeight, setBannerHeight] = useState(150);
  const navigation = useLiveNavigation(
    c.plan,
    c.gps.fix,
    mapMode && c.tracker.active && c.gps.focused,
    c.user?.id,
  );
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [mapMode]);
  const ready = canRecordFix(c.gps.fix);
  const average =
    c.tracker.seconds > 0 ? c.tracker.km / (c.tracker.seconds / 3600) : 0;
  const center = () => {
    navigation.setFollow(true);
    c.setCenterRequest((value) => value + 1);
    if (!c.gps.position || c.gps.status === "error") c.gps.request();
  };
  const finish = () =>
    Alert.alert(
      "¿Finalizar recorrido?",
      "Se detendrá el registro y se guardará tu actividad si has iniciado sesión.",
      [
        { text: "Seguir pedaleando", style: "cancel" },
        { text: "Finalizar", onPress: () => void c.finish() },
      ],
    );
  const start = () => {
    if (ready) {
      c.startRecording();
    } else if (c.gps.fix) c.gps.openSettings();
    else c.gps.request();
  };
  const map = (
    <CyclingMap
      fill
      tracked={c.tracker.points}
      showUser={c.tracker.active}
      currentLocation={c.gps.position}
      centerRequest={c.centerRequest}
      initialFocus="location"
      geometry={navigation.route?.geometry ?? c.plan?.route.geometry}
      origin={c.plan?.origin}
      destination={c.plan?.destination.coordinate}
      infrastructure={mapMode ? navigation.lanes.data : undefined}
      followLocation={mapMode && navigation.follow && c.tracker.active}
      navigationMode={mapMode}
      navigationTopInset={bannerHeight + 24}
      navigationBearing={navigation.heading}
      onFollowChange={navigation.setFollow}
    />
  );
  const notices = (
    <>
      {c.gps.loading && <Notice message="Buscando tu ubicación actual…" />}
      {!!c.gps.error && <Notice message={c.gps.error} />}
      {!!c.gps.fix && !ready && !c.gps.loading && (
        <Notice message="Activa Ubicación precisa y espera una mejor señal GPS para registrar distancia." />
      )}
      {(
        ["denied", "approximate", "disabled", "timeout", "error"] as string[]
      ).includes(c.gps.status) && (
        <PrimaryButton
          title="Abrir ajustes de ubicación"
          outline
          onPress={c.gps.openSettings}
        />
      )}
      {!!c.tracker.error && <Notice message={c.tracker.error} />}
      {c.saved && <Notice message="¡Bien hecho! Tu recorrido se guardó." />}
    </>
  );
  const controls = (
    <View style={s.controls}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-around",
          gap: 14,
        }}
      >
        <IconButton
          icon="locate-outline"
          label="Centrar mi ubicación"
          onPress={center}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            c.tracker.active
              ? "Finalizar y guardar recorrido"
              : ready
                ? "Comenzar recorrido"
                : "Revisar ubicación GPS"
          }
          disabled={c.saving || (c.gps.loading && !c.tracker.active)}
          onPress={c.tracker.active ? finish : start}
          style={({ pressed }) => [
            s.recordButton,
            (pressed || c.saving || (c.gps.loading && !c.tracker.active)) && {
              opacity: 0.5,
            },
          ]}
        >
          <Ionicons
            name={c.tracker.active ? "stop" : "play"}
            size={30}
            color={colors.black}
          />
        </Pressable>
        <IconButton
          icon={mapMode ? "grid-outline" : "map-outline"}
          label={mapMode ? "Mostrar datos del recorrido" : "Ampliar mapa"}
          active={mapMode}
          onPress={() => setMapMode(!mapMode)}
        />
      </View>
      <AppText
        weight="bold"
        style={{ textAlign: "center", marginTop: 12, fontSize: 13 }}
      >
        {c.saving
          ? "Guardando recorrido…"
          : c.tracker.active
            ? "Finalizar y guardar"
            : c.gps.loading
              ? "Buscando ubicación…"
              : ready
                ? "Empezar a pedalear"
                : "Revisar ubicación GPS"}
      </AppText>
      {!c.tracker.active && !!c.tracker.started && !c.saved && (
        <PrimaryButton
          title={c.saving ? "Guardando…" : "Guardar recorrido detenido"}
          disabled={c.saving}
          onPress={() => void c.finish()}
        />
      )}
      {!mapMode && (
        <PrimaryButton
          title="Abrir navegación en vivo →"
          disabled={!c.tracker.active}
          onPress={() => setMapMode(true)}
        />
      )}
    </View>
  );
  return (
    <View style={s.screen}>
      <ScreenHeader title={mapMode ? "Ruta en vivo" : "Grabación en vivo"} />
      <ScrollView
        ref={scroll}
        removeClippedSubviews={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <View
          key="telemetry"
          style={{ gap: 16, display: mapMode ? "none" : "flex" }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <Chip
              icon="radio-outline"
              label={
                ready
                  ? "GPS preciso"
                  : c.gps.loading
                    ? "Buscando GPS"
                    : c.gps.position
                      ? "GPS aproximado"
                      : "Sin señal GPS"
              }
              active={ready}
            />
            <Chip
              icon={c.tracker.active ? "recording-outline" : "ellipse-outline"}
              label={
                c.tracker.active
                  ? "Grabando"
                  : c.saved
                    ? "Guardado"
                    : "En espera"
              }
              active={c.tracker.active}
            />
          </View>
          <View style={s.hero}>
            <AppText style={s.timerLabel}>TIEMPO DE RECORRIDO</AppText>
            <AppText
              weight="heavy"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[s.timer, { fontSize: width < 350 ? 43 : 52 }]}
            >
              {clock(c.tracker.seconds)}
            </AppText>
            <View style={s.row}>
              <View style={s.heroMetric}>
                <AppText
                  weight="heavy"
                  style={{
                    fontSize: 39,
                    color: colors.green,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {average.toFixed(1)}
                </AppText>
                <AppText style={s.heroLabel}>KM/H · VELOCIDAD MEDIA</AppText>
              </View>
              <View style={s.heroMetric}>
                <AppText
                  weight="heavy"
                  style={{
                    fontSize: 39,
                    color: colors.white,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {c.tracker.km.toFixed(2)}
                </AppText>
                <AppText style={s.heroLabel}>KILÓMETROS</AppText>
              </View>
            </View>
          </View>
          <View style={s.row}>
            <MetricTile
              icon="locate-outline"
              value={
                c.gps.fix?.accuracy != null
                  ? `± ${Math.round(c.gps.fix.accuracy)} m`
                  : "—"
              }
              label="PRECISIÓN GPS"
            />
            <MetricTile
              icon="trail-sign-outline"
              value={String(c.tracker.points.length)}
              label="PUNTOS REGISTRADOS"
            />
          </View>
          {c.plan && (
            <View style={s.plan}>
              <Ionicons
                name="flag-outline"
                size={20}
                color={colors.greenDark}
              />
              <View style={{ flex: 1, gap: 5 }}>
                <AppText weight="bold" numberOfLines={2}>
                  {c.plan.destination.label}
                </AppText>
                <AppText style={s.caption}>
                  {(c.plan.route.distanceMeters / 1000).toFixed(1)} km · ≈{" "}
                  {Math.round(c.plan.route.durationSeconds / 60)} min de ruta
                  estimada
                </AppText>
              </View>
              <IconButton
                icon="expand-outline"
                label="Abrir vista de ruta"
                onPress={() => setMapMode(true)}
              />
            </View>
          )}
        </View>
        <View
          key="live-map"
          style={[
            s.mapPreview,
            mapMode && { height: Math.max(340, height * 0.6) },
          ]}
        >
          {map}
          <View
            onLayout={(event) => {
              if (mapMode) setBannerHeight(event.nativeEvent.layout.height);
            }}
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              right: mapMode ? 12 : 70,
            }}
          >
            {mapMode ? (
              <LiveNavigationPanel
                navigation={navigation}
                recording={c.tracker.active}
              />
            ) : (
              <Chip
                icon="location"
                label={c.plan?.destination.label || "Tu recorrido en vivo"}
                active
              />
            )}
          </View>
          <View
            style={{
              position: "absolute",
              top: mapMode ? undefined : 12,
              bottom: mapMode ? 94 : undefined,
              right: 12,
            }}
          >
            <IconButton
              icon={mapMode ? "contract-outline" : "expand-outline"}
              label={mapMode ? "Reducir mapa" : "Ampliar mapa"}
              onPress={() => setMapMode(!mapMode)}
            />
          </View>
          <View style={{ position: "absolute", bottom: 36, right: 12 }}>
            <IconButton
              dark
              icon="locate"
              label="Centrar GPS"
              onPress={center}
            />
          </View>
        </View>
        {mapMode && (
          <View style={s.row}>
            <MetricTile value={c.tracker.km.toFixed(2)} label="KM RECORRIDOS" />
            <MetricTile value={clock(c.tracker.seconds)} label="TIEMPO" />
            <MetricTile value={average.toFixed(1)} label="KM/H MEDIA" />
          </View>
        )}
        {notices}
        {mapMode && (
          <View style={{ gap: 12 }}>
            {navigation.ready && !!navigation.progress && (
              <>
                <AppText weight="bold">
                  {distanceLabel(navigation.progress.remaining)} por recorrer ·{" "}
                  {Math.min(
                    100,
                    Math.round(
                      (navigation.progress.progress /
                        Math.max(
                          1,
                          navigation.progress.progress +
                            navigation.progress.remaining,
                        )) *
                        100,
                    ),
                  )}
                  % del trazado
                </AppText>
                <View
                  accessibilityRole="progressbar"
                  accessibilityValue={{
                    min: 0,
                    max: 100,
                    now: Math.min(
                      100,
                      Math.round(
                        (navigation.progress.progress /
                          Math.max(
                            1,
                            navigation.progress.progress +
                              navigation.progress.remaining,
                          )) *
                          100,
                      ),
                    ),
                  }}
                  style={{
                    height: 7,
                    borderRadius: 4,
                    backgroundColor: colors.surfaceLow,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      height: 7,
                      width: `${Math.min(100, (navigation.progress.progress / Math.max(1, navigation.progress.progress + navigation.progress.remaining)) * 100)}%`,
                      backgroundColor: colors.green,
                    }}
                  />
                </View>
              </>
            )}
            <PrimaryButton
              title={
                navigation.voice
                  ? "Silenciar indicaciones por voz"
                  : "Activar indicaciones por voz"
              }
              outline
              disabled={!c.tracker.active}
              onPress={navigation.toggleVoice}
            />
            <PrimaryButton
              title={
                navigation.follow
                  ? "Explorar el mapa libremente"
                  : "Seguir mi movimiento"
              }
              outline
              onPress={() =>
                navigation.follow ? navigation.setFollow(false) : center()
              }
            />
            {!!c.plan && (
              <PrimaryButton
                title={
                  navigation.recalculating
                    ? "Recalculando…"
                    : navigation.route?.steps?.length
                      ? "Recalcular desde aquí"
                      : "Actualizar indicaciones"
                }
                outline
                disabled={
                  navigation.recalculating ||
                  !navigation.precise ||
                  !c.tracker.active
                }
                onPress={() => void navigation.recalculate()}
              />
            )}
            {!navigation.streetName && !!navigation.streetError && (
              <>
                <Notice message={navigation.streetError} />
                <PrimaryButton
                  title="Reintentar nombre de calle"
                  outline
                  onPress={navigation.retryStreet}
                />
              </>
            )}
            {!!navigation.error && <Notice message={navigation.error} />}
            {!!navigation.lanes.error && navigation.lanes.canRetry && (
              <>
                <Notice message={`Ciclovías: ${navigation.lanes.error}`} />
                <PrimaryButton
                  title="Reintentar ciclovías"
                  outline
                  onPress={navigation.lanes.retry}
                />
              </>
            )}
          </View>
        )}
        {controls}
        <AppText style={s.caption}>
          El registro se detiene al salir de esta pantalla o poner la app en
          segundo plano. Al volver puedes guardar el recorrido detenido.
        </AppText>
      </ScrollView>
      <SaveRideDialog controller={c} />
    </View>
  );
}
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 20,
      gap: 16,
      paddingBottom: 30,
      maxWidth: 760,
      width: "100%",
      alignSelf: "center",
    },
    row: { flexDirection: "row", gap: 10 },
    hero: {
      borderRadius: 28,
      backgroundColor: colors.black,
      padding: 22,
      paddingTop: 26,
      gap: 16,
    },
    timerLabel: {
      color: "#C3CDC0",
      textAlign: "center",
      fontSize: 10,
      letterSpacing: 2,
    },
    timer: {
      textAlign: "center",
      color: colors.white,
      letterSpacing: -1,
      fontVariant: ["tabular-nums"],
      marginBottom: 10,
    },
    heroMetric: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      borderRadius: 18,
      backgroundColor: "#262D26",
      paddingVertical: 22,
      gap: 8,
    },
    heroLabel: {
      color: "#C3CDC0",
      fontSize: 8,
      letterSpacing: 0.4,
      textAlign: "center",
    },
    mapPreview: { height: 240, borderRadius: 24, overflow: "hidden" },
    plan: {
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    controls: {
      padding: 20,
      borderRadius: 26,
      backgroundColor: colors.surface,
      gap: 10,
    },
    recordButton: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: colors.green,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 5,
      borderColor: colors.softGreen,
    },
    caption: { color: colors.muted, fontSize: 11, lineHeight: 18 },
    routeBanner: {
      position: "absolute",
      top: 14,
      left: 16,
      right: 16,
      borderRadius: 24,
      padding: 18,
      backgroundColor: colors.black,
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
    },
    bannerIcon: {
      width: 42,
      height: 42,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#303B2A",
    },
  });
