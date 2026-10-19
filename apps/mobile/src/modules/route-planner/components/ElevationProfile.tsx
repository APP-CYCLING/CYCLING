import React, { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PlannedRoute } from "@cycling/contracts";
import { AppText } from "../../../shared/components/DesignSystem";
import { BrandLoader } from "../../../shared/components/BrandLoader";
import { useThemeColors } from "../../../shared/theme/ThemeContext";

export function elevationLabel(route: PlannedRoute, loss = false) {
  const value = loss ? route.elevationLossMeters : route.elevationGainMeters;
  return route.elevationStatus === "loading"
    ? "Calculando…"
    : value == null
      ? "Sin datos"
      : `${Math.round(value)} m`;
}
export function ElevationProfile({
  route,
  label = "Perfil de elevación",
}: {
  route: PlannedRoute;
  label?: string;
}) {
  const colors = useThemeColors(),
    [width, setWidth] = useState(1),
    [index, setIndex] = useState(0);
  const profile = route.elevationProfile ?? [];
  useEffect(() => setIndex(0), [route.elevationProfile]);
  const known = profile.flatMap((p) =>
    p.elevationMeters == null ? [] : [p.elevationMeters],
  );
  const low = known.length ? Math.min(...known) : 0,
    high = known.length ? Math.max(...known) : 0;
  const range = Math.max(10, high - low),
    span = profile.at(-1)?.distanceMeters ?? 1;
  const plotHeight = 120;
  const point = (i: number) => ({
    x: (profile[i].distanceMeters / Math.max(1, span)) * width,
    y:
      plotHeight -
      (((profile[i].elevationMeters ?? low) -
        low +
        (range - (high - low)) / 2) /
        range) *
        plotHeight,
  });
  const selected = profile[Math.min(index, profile.length - 1)];
  const selectAt = (x: number) => {
    const at = Math.max(0, Math.min(1, x / width)) * span;
    let closest = 0;
    profile.forEach((p, i) => {
      if (
        Math.abs(p.distanceMeters - at) <
        Math.abs(profile[closest].distanceMeters - at)
      )
        closest = i;
    });
    setIndex(closest);
  };
  return (
    <View style={{ gap: 12 }}>
      <AppText weight="bold" style={{ fontSize: 18 }}>
        {label}
      </AppText>
      <AppText weight="bold">
        D+ {elevationLabel(route)} · D− {elevationLabel(route, true)}
      </AppText>
      {route.elevationStatus === "loading" ? (
        <BrandLoader size="small" message="Calculando elevación…" />
      ) : known.length > 1 ? (
        <>
          <AppText style={{ fontSize: 12, color: colors.muted }}>
            Mín. {Math.round(low)} m · Máx. {Math.round(high)} m
          </AppText>
          <View style={{ paddingVertical: 10 }}>
            <View
              accessible
              accessibilityRole="adjustable"
              accessibilityLabel="Altitud a lo largo de la ruta"
              accessibilityValue={{
                text: selected
                  ? `${(selected.distanceMeters / 1000).toFixed(2)} kilómetros, ${selected.elevationMeters == null ? "sin datos" : `${Math.round(selected.elevationMeters)} metros`}`
                  : "Sin datos",
              }}
              accessibilityActions={[
                { name: "increment", label: "Siguiente muestra" },
                { name: "decrement", label: "Muestra anterior" },
              ]}
              onAccessibilityAction={(event) =>
                setIndex((i) =>
                  Math.max(
                    0,
                    Math.min(
                      profile.length - 1,
                      i +
                        (event.nativeEvent.actionName === "increment" ? 1 : -1),
                    ),
                  ),
                )
              }
              onLayout={(event) =>
                setWidth(Math.max(1, event.nativeEvent.layout.width))
              }
              onTouchStart={(event) => selectAt(event.nativeEvent.locationX)}
              onTouchMove={(event) => selectAt(event.nativeEvent.locationX)}
              style={{
                height: plotHeight,
                backgroundColor: colors.surfaceLow,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {[0, 0.5, 1].map((t) => (
                <View
                  pointerEvents="none"
                  key={t}
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: t * (plotHeight - 1),
                    height: 1,
                    backgroundColor: colors.border,
                  }}
                />
              ))}
              {profile.slice(1).map((p, i) => {
                if (
                  p.elevationMeters == null ||
                  profile[i].elevationMeters == null ||
                  p.segmentIndex !== profile[i].segmentIndex
                )
                  return null;
                const a = point(i),
                  b = point(i + 1),
                  dx = b.x - a.x,
                  dy = b.y - a.y,
                  length = Math.hypot(dx, dy);
                return (
                  <View
                    pointerEvents="none"
                    key={i}
                    style={{
                      position: "absolute",
                      left: (a.x + b.x - length) / 2,
                      top: (a.y + b.y) / 2 - 1,
                      width: length,
                      height: 2,
                      backgroundColor: colors.greenDark,
                      transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
                    }}
                  />
                );
              })}
              {selected && (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: point(Math.min(index, profile.length - 1)).x,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: colors.muted,
                  }}
                />
              )}
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <AppText style={{ fontSize: 11 }}>0 km</AppText>
              <AppText style={{ fontSize: 11 }}>
                {(span / 1000).toFixed(2)} km
              </AppText>
            </View>
          </View>
          <AppText accessibilityLiveRegion="polite" style={{ fontSize: 13 }}>
            {selected
              ? `${(selected.distanceMeters / 1000).toFixed(2)} km · ${selected.elevationMeters == null ? "Sin datos" : `${Math.round(selected.elevationMeters)} m de altitud`}`
              : ""}
          </AppText>
          <AppText style={{ fontSize: 11, color: colors.muted }}>
            Toca o desliza sobre el perfil para consultar la altitud.
          </AppText>
        </>
      ) : (
        <AppText style={{ color: colors.muted }}>
          Sin datos de elevación.
        </AppText>
      )}
      {!!route.elevationError && route.elevationStatus !== "loading" && (
        <AppText style={{ fontSize: 12, color: colors.muted }}>
          {route.elevationError}
        </AppText>
      )}
      {!!route.elevationSource && (
        <AppText style={{ fontSize: 11, color: colors.muted }}>
          Fuente:{" "}
          {route.elevationSource === "geoapify" ? "Geoapify" : "MapTiler"} ·
          Elevación del terreno estimada
          {route.elevationSampleSpacingMeters
            ? ` · Muestreo objetivo ≈ ${Math.round(route.elevationSampleSpacingMeters)} m`
            : ""}
          . Puede omitir estructuras como puentes o túneles.
        </AppText>
      )}
    </View>
  );
}
export function ElevationProfileButton({ route }: { route: PlannedRoute }) {
  const [open, setOpen] = useState(false),
    colors = useThemeColors(),
    insets = useSafeAreaInsets();
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <AppText
          weight="bold"
          style={{ color: colors.greenDark, fontSize: 12 }}
        >
          Ver perfil de elevación · D+ {elevationLabel(route)}
        </AppText>
      </Pressable>
      <Modal
        visible={open}
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 20,
            gap: 20,
            backgroundColor: colors.background,
            flexGrow: 1,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setOpen(false)}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <AppText weight="bold" style={{ color: colors.greenDark }}>
              Cerrar perfil
            </AppText>
          </Pressable>
          <ElevationProfile route={route} />
        </ScrollView>
      </Modal>
    </>
  );
}
