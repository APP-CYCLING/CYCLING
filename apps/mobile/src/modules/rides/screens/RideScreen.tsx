import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { usePlannedRide } from "../../navigation/services/planned-ride.store";
import {
  Page,
  H1,
  Subtitle,
  Panel,
  PrimaryButton,
  Notice,
} from "../../../shared/components/UI";
import { CyclingMap } from "../../maps/components/CyclingMap";
import { useRideTracker } from "../hooks/useRideTracker";
import { ridesService } from "../services/rides.service";
import { useAuth } from "../../auth/context/AuthContext";
import { colors } from "../../../shared/theme/colors";
const format = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
export default function RideScreen() {
  const tracker = useRideTracker(),
    { user } = useAuth(),
    [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false);
  const plan = usePlannedRide(user?.id),
    { start } = useLocalSearchParams<{ start?: string }>(),
    lastStart = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (start && start !== lastStart.current) {
      lastStart.current = start;
      if (!tracker.active) {
        setSaved(false);
        void tracker.start();
      }
    }
  }, [start]);
  const finish = async () => {
    const stopped = tracker.stop();
    if (!user) {
      Alert.alert(
        "Recorrido finalizado",
        "Inicia sesión para guardar tu actividad.",
        [
          { text: "Ir a mi cuenta", onPress: () => router.push("/auth") },
          { text: "Cerrar" },
        ],
      );
      return;
    }
    if (!tracker.started) return;
    setSaving(true);
    try {
      await ridesService.create({
        routeId: null,
        distanceKm: Number(tracker.km.toFixed(3)),
        durationSec: stopped.durationSec,
        startedAt: tracker.started,
        endedAt: stopped.endedAt,
        coordinates: tracker.points,
      });
      setSaved(true);
      Alert.alert("¡Bien hecho!", "Tu recorrido se guardó.");
    } catch (e: unknown) {
      Alert.alert("No se pudo guardar", e instanceof Error ? e.message : "Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Page>
      <H1>Pedalear 🚴</H1>
      <Subtitle>
        {plan
          ? `Destino: ${plan.destination.label}`
          : "Registra tu trayecto con el GPS del teléfono."}
      </Subtitle>
      <View style={{ marginTop: 20 }}>
        <CyclingMap
          tracked={tracker.points}
          showUser={tracker.active}
          geometry={plan?.route.geometry}
          origin={plan?.origin}
          destination={plan?.destination.coordinate}
          height={340}
        />
      </View>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
        <View style={{ flex: 1 }}>
          <Panel>
            <Text
              style={{ fontSize: 25, fontWeight: "900", color: colors.black }}
            >
              {tracker.km.toFixed(2)}
            </Text>
            <Text style={{ color: colors.muted }}>Kilómetros</Text>
          </Panel>
        </View>
        <View style={{ flex: 1 }}>
          <Panel>
            <Text
              style={{ fontSize: 25, fontWeight: "900", color: colors.black }}
            >
              {format(tracker.seconds)}
            </Text>
            <Text style={{ color: colors.muted }}>Duración</Text>
          </Panel>
        </View>
      </View>
      <View style={{ marginTop: 18 }}>
        {tracker.active ? (
          <PrimaryButton
            title={saving ? "Guardando..." : "Finalizar y guardar"}
            onPress={finish}
            disabled={saving}
          />
        ) : (
          <PrimaryButton
            title="Iniciar GPS"
            onPress={() => {
              setSaved(false);
              void tracker.start();
            }}
          />
        )}
      </View>
      {!tracker.active && !!tracker.started && !saved && (
        <PrimaryButton
          title={saving ? "Guardando..." : "Guardar recorrido detenido"}
          onPress={finish}
          disabled={saving}
        />
      )}
      {saved && <Notice message="Tu recorrido se guardó." />}
      {!!tracker.error && (
        <View style={{ marginTop: 12 }}>
          <Notice message={tracker.error} />
        </View>
      )}
      <Text
        style={{
          color: colors.muted,
          marginTop: 14,
          fontSize: 12,
          lineHeight: 18,
        }}
      >
        El registro se detiene al salir de esta pantalla o poner la app en segundo plano. Al volver puedes guardar el recorrido detenido. Sigue las normas de circulación y no manipules el teléfono mientras pedaleas.
      </Text>
    </Page>
  );
}
