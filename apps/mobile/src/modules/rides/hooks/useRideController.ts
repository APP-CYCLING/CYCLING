import { useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { CreateRideInput } from "@cycling/contracts";
import { usePlannedRide } from "../../navigation/services/planned-ride.store";
import { useRideTracker } from "./useRideTracker";
import { ridesService } from "../services/rides.service";
import {
  ridePhotosService,
  type DraftPhoto,
} from "../services/ride-photos.service";
import { automaticRideName, savedRideName } from "../utils/ride-name";
import { useAuth } from "../../auth/context/AuthContext";
import { useUserLocation } from "../../geolocation/hooks/useUserLocation";
import { canRecordFix } from "../../geolocation/utils/location-policy";
export function useRideController() {
  const gps = useUserLocation(),
    tracker = useRideTracker(gps.fix, gps.focused),
    { user } = useAuth();
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [centerRequest, setCenterRequest] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false),
    [rideName, setRideName] = useState(""),
    [automaticName, setAutomaticName] = useState(""),
    [saveError, setSaveError] = useState("");
  const plan = usePlannedRide(user?.id),
    { start } = useLocalSearchParams<{ start?: string }>();
  const lastStart = useRef<string | undefined>(undefined),
    pending = useRef<CreateRideInput | null>(null),
    inFlight = useRef(false),
    mounted = useRef(true);
  const recordingDestination = useRef<string | null>(null);
  const recordingPlan = useRef(plan);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const savedId = useRef<string | null>(null),
    uploadedPhotos = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const finish = () => {
    if (inFlight.current || saved) return;
    const stopped = tracker.stop();
    if (!stopped.startedAt) return;
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
    if (!pending.current) {
      pending.current = {
        routeId: null,
        destinationName: recordingDestination.current,
        plannedRoute: recordingPlan.current?.route ?? null,
        destination: recordingPlan.current?.destination.coordinate ?? null,
        stopPosition: stopped.coordinates.at(-1) ?? null,
        distanceKm: Number(stopped.distanceKm.toFixed(3)),
        durationSec: stopped.durationSec,
        startedAt: stopped.startedAt,
        endedAt: stopped.endedAt,
        coordinates: stopped.coordinates,
      };
      setAutomaticName(
        automaticRideName(recordingDestination.current, stopped.endedAt),
      );
      setRideName("");
      setSaveError("");
    }
    setSaveDialogOpen(true);
  };
  const startRecording = (discard = false) => {
    if (inFlight.current) return;
    if (!discard && tracker.started && !saved && !tracker.active) {
      Alert.alert(
        "Tienes un recorrido sin guardar",
        "Guárdalo antes de iniciar otro o descártalo.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Guardar", onPress: finish },
          {
            text: "Descartar e iniciar",
            style: "destructive",
            onPress: () => startRecording(true),
          },
        ],
      );
      return;
    }
    if (tracker.start()) {
      recordingDestination.current = plan?.destination.label ?? null;
      recordingPlan.current = plan;
      savedId.current = null;
      uploadedPhotos.current.clear();
      setPhotos([]);
      pending.current = null;
      setSaved(false);
      setSaveDialogOpen(false);
      setRideName("");
      setSaveError("");
    }
  };
  useEffect(() => {
    if (
      start &&
      start !== lastStart.current &&
      gps.focused &&
      canRecordFix(gps.fix)
    ) {
      lastStart.current = start;
      if (!tracker.active) startRecording();
    }
  }, [start, gps.fix, gps.focused]);
  useEffect(() => {
    if (gps.focused) setCenterRequest((value) => value + 1);
  }, [gps.focused]);
  const saveRide = async () => {
    if (!pending.current || !user || inFlight.current) return;
    setSaveError("");
    try {
      const input = {
        ...pending.current,
        title: savedRideName(
          rideName,
          pending.current.destinationName,
          pending.current.endedAt,
        ),
      };
      inFlight.current = true;
      setSaving(true);
      if (!savedId.current)
        savedId.current = (await ridesService.create(input)).id;
      await ridePhotosService.upload(
        savedId.current,
        photos,
        uploadedPhotos.current,
      );
      if (mounted.current) {
        pending.current = null;
        setSaved(true);
        setSaveDialogOpen(false);
        Alert.alert("¡Bien hecho!", `Se guardó «${input.title}».`);
      }
    } catch (e: unknown) {
      if (mounted.current)
        setSaveError(
          e instanceof Error
            ? e.message
            : "No se pudo guardar. Puedes reintentarlo.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return {
    gps,
    tracker,
    user,
    saving,
    saved,
    centerRequest,
    setCenterRequest,
    plan,
    finish,
    startRecording,
    saveDialogOpen,
    closeSaveDialog: () => {
      if (!inFlight.current) setSaveDialogOpen(false);
    },
    rideName,
    setRideName,
    automaticName,
    saveError,
    saveRide,
    photos,
    setPhotos,
    rideAlreadySaved: !!savedId.current,
  };
}
