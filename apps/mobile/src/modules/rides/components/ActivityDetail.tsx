import React, { useEffect, useRef, useState } from "react";
import { Image, View } from "react-native";
import { router } from "expo-router";
import type { Ride } from "@cycling/contracts";
import { AppText } from "../../../shared/components/DesignSystem";
import {
  Busy,
  Notice,
  Panel,
  PrimaryButton,
} from "../../../shared/components/UI";
import { useAuth } from "../../auth/context/AuthContext";
import { setRepeatRide } from "../../navigation/services/repeat-ride.store";
import {
  ridePhotosService,
  type DraftPhoto,
  type RidePhoto,
} from "../services/ride-photos.service";
import { PhotoDraftPicker } from "./PhotoDraftPicker";
import { RecordedRideMap, rideStatusLabel } from "./RecordedRideMap";
import { RideMetrics } from "./ActivityRideCard";
import { rideDisplayName } from "../utils/ride-name";
import { useThemeColors } from "../../../shared/theme/ThemeContext";

export function ActivityDetail({
  ride,
  onClose,
}: {
  ride: Ride;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<RidePhoto[]>([]),
    [drafts, setDrafts] = useState<DraftPhoto[]>([]);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  const uploaded = useRef(new Set<string>()),
    active = useRef(true),
    inFlight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    ridePhotosService
      .list(ride.id)
      .then((value) => {
        if (current) setPhotos(value);
      })
      .catch((e) => {
        if (current)
          setError(
            e instanceof Error ? e.message : "No se pudieron cargar las fotos.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [ride.id, revision, user?.id]);
  const upload = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await ridePhotosService.upload(ride.id, drafts, uploaded.current);
      if (active.current) {
        setDrafts([]);
        uploaded.current.clear();
        setRevision((value) => value + 1);
      }
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error
            ? e.message
            : "No se pudieron guardar las fotos. Reintenta.",
        );
    } finally {
      inFlight.current = false;
      if (active.current) setSaving(false);
    }
  };
  const destination = ride.destination ?? ride.coordinates.at(-1);
  const repeat = () => {
    if (!destination || !user) return;
    setRepeatRide({
      userId: user.id,
      destination: {
        id: `repeat:${ride.id}`,
        label: ride.destinationName || "Último punto de esta salida",
        coordinate: destination,
      },
    });
    onClose();
    router.push("/explore");
  };
  return (
    <>
      <AppText weight="bold" style={{ fontSize: 22 }}>
        {rideDisplayName(ride)}
      </AppText>
      <AppText weight="bold">{rideStatusLabel(ride)}</AppText>
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        <RecordedRideMap ride={ride} height={340} />
      </View>
      <RideMetrics ride={ride} />
      <Panel>
        <AppText weight="bold">Registro de tu salida</AppText>
        <AppText>
          Inicio: {new Date(ride.startedAt).toLocaleString("es")}
        </AppText>
        <AppText>Fin: {new Date(ride.endedAt).toLocaleString("es")}</AppText>
        {!!ride.destinationName && (
          <AppText>Destino: {ride.destinationName}</AppText>
        )}
        {!!ride.plannedRoute && (
          <AppText>
            Ruta prevista:{" "}
            {(ride.plannedRoute.distanceMeters / 1000).toFixed(2)} km ·{" "}
            {Math.max(1, Math.round(ride.plannedRoute.durationSeconds / 60))}{" "}
            min estimados
          </AppText>
        )}
        {!!(ride.stopPosition ?? ride.coordinates.at(-1)) && (
          <AppText>
            Último punto GPS:{" "}
            {(ride.stopPosition ?? ride.coordinates.at(-1))!.latitude.toFixed(
              5,
            )}
            ,{" "}
            {(ride.stopPosition ?? ride.coordinates.at(-1))!.longitude.toFixed(
              5,
            )}
          </AppText>
        )}
        <AppText style={{ fontSize: 12, lineHeight: 18 }}>
          La llegada se estima con el último punto GPS a menos de 50 m del
          destino y al menos el 80 % de la distancia prevista registrada. No
          confirma que hayas seguido cada tramo.
        </AppText>
      </Panel>
      <AppText weight="bold" style={{ fontSize: 18 }}>
        Fotos de tu actividad
      </AppText>
      {loading ? (
        <Busy />
      ) : (
        <>
          {!photos.length && !error && (
            <AppText>Aún no has añadido fotos.</AppText>
          )}
          {photos.map((photo) => (
            <View key={photo.path} style={{ gap: 8 }}>
              <Image
                source={{ uri: photo.url }}
                accessibilityLabel="Foto de tu recorrido"
                resizeMode="contain"
                style={{
                  width: "100%",
                  height: 260,
                  backgroundColor: colors.surfaceLow,
                  borderRadius: 18,
                }}
                onError={() =>
                  setError(
                    "No se pudo abrir una foto. Actualiza la galería para reintentar.",
                  )
                }
              />
            </View>
          ))}
          <PhotoDraftPicker
            photos={drafts}
            onChange={setDrafts}
            limit={Math.max(0, 6 - photos.length)}
            disabled={saving || uploaded.current.size > 0 || !!error}
          />
          {!!drafts.length && (
            <PrimaryButton
              title={saving ? "Guardando fotos…" : "Guardar fotos"}
              disabled={saving}
              onPress={() => void upload()}
            />
          )}
        </>
      )}
      {!!error && <Notice message={error} />}
      <PrimaryButton
        title="Actualizar galería"
        outline
        disabled={loading || saving}
        onPress={() => setRevision((value) => value + 1)}
      />
      {!!destination && (
        <>
          <PrimaryButton
            title="Volver a hacer este recorrido →"
            onPress={repeat}
          />
          <AppText style={{ fontSize: 12, lineHeight: 18 }}>
            Planificaremos una nueva ruta al{" "}
            {ride.destination ? "mismo destino" : "último punto GPS guardado"},
            desde tu ubicación actual.
          </AppText>
        </>
      )}
    </>
  );
}
