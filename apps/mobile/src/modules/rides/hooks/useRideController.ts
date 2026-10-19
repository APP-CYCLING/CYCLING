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
import {
  canRecordFix,
  isFreshFix,
} from "../../geolocation/utils/location-policy";
export function useRideController() {
  const { user } = useAuth();
  const tracker = useRideTracker(user?.id);
  const foregroundGps = useUserLocation(!tracker.active);
  const recordingFix =
    tracker.active && isFreshFix(tracker.lastFix) ? tracker.lastFix : null;
  const gps = tracker.active
    ? {
        ...foregroundGps,
        fix: recordingFix,
        position: recordingFix?.coordinate ?? null,
        loading: !recordingFix,
        error: "",
        status: recordingFix ? ("ready" as const) : ("loading" as const),
      }
    : foregroundGps;
  const [saving, setSaving] = useState(false),
    [saved, setSaved] = useState(false),
    [centerRequest, setCenterRequest] = useState(0);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false),
    [rideName, setRideName] = useState(""),
    [automaticName, setAutomaticName] = useState(""),
    [saveError, setSaveError] = useState("");
  const selectedPlan = usePlannedRide(user?.id),
    { start } = useLocalSearchParams<{ start?: string }>();
  const plan = tracker.started ? tracker.plan : selectedPlan;
  const lastStart = useRef<string | undefined>(undefined),
    pending = useRef<CreateRideInput | null>(null),
    inFlight = useRef(false),
    mounted = useRef(true);
  const [photos, setPhotos] = useState<DraftPhoto[]>([]);
  const savedId = useRef<string | null>(null),
    uploadedPhotos = useRef(new Set<string>());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const finish = async () => {
    if (inFlight.current || saved) return;
    let stopped: Awaited<ReturnType<typeof tracker.stop>>;
    try {
      stopped = await tracker.stop();
    } catch (error) {
      Alert.alert(
        "No se pudo finalizar",
        error instanceof Error ? error.message : "Intenta finalizar otra vez.",
      );
      return;
    }
    if (!stopped.startedAt) return;
    const capturedPlan = stopped.plan;
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
        destinationName: capturedPlan?.destination.label ?? null,
        plannedRoute: capturedPlan?.route ?? null,
        destination: capturedPlan?.destination.coordinate ?? null,
        stopPosition: stopped.coordinates.at(-1) ?? null,
        distanceKm: Number(stopped.distanceKm.toFixed(3)),
        durationSec: stopped.durationSec,
        startedAt: stopped.startedAt,
        endedAt: stopped.endedAt,
        coordinates: stopped.coordinates,
      };
      setAutomaticName(
        automaticRideName(
          capturedPlan?.destination.label ?? null,
          stopped.endedAt,
        ),
      );
      setRideName("");
      setSaveError("");
    }
    setSaveDialogOpen(true);
  };
  const startRecording = async (discard = false) => {
    if (inFlight.current || tracker.busy || !tracker.ready || tracker.active)
      return;
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
    if (await tracker.start(gps.fix, selectedPlan, discard || saved)) {
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
      tracker.ready &&
      gps.focused &&
      canRecordFix(gps.fix)
    ) {
      lastStart.current = start;
      if (!tracker.active) startRecording();
    }
  }, [start, gps.fix, gps.focused, tracker.ready]);
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
      if (!savedId.current) savedId.current = tracker.savedRideId;
      if (!savedId.current) {
        savedId.current = (await ridesService.create(input)).id;
      }
      await tracker.markSaved(savedId.current);
      await ridePhotosService.upload(
        savedId.current,
        photos,
        uploadedPhotos.current,
      );
      await tracker.clear();
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
