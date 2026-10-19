import { useEffect, useState, useSyncExternalStore } from "react";
import type { LocationFix } from "../../geolocation/types/location.types";
import { rideRecording } from "../services/ride-recording.service";
import type { RecordingPlan } from "../services/recording-store";

export function useRideTracker(userId?: string) {
  const owner = userId ?? "guest";
  const state = useSyncExternalStore(
    rideRecording.subscribe,
    rideRecording.getSnapshot,
    rideRecording.getSnapshot,
  );
  const draft = state.owner === owner ? state.draft : null;
  const [now, setNow] = useState(Date.now());
  const active = draft?.status === "active";
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active]);
  return {
    active,
    busy: state.busy,
    ready: state.ready && state.owner === owner,
    points: draft?.points ?? [],
    km: draft?.km ?? 0,
    seconds: draft
      ? Math.max(
          0,
          Math.floor(((draft.endedMs ?? now) - draft.startedMs) / 1000),
        )
      : 0,
    started: draft ? new Date(draft.startedMs).toISOString() : null,
    error: state.error,
    plan: draft?.plan ?? null,
    lastFix: draft?.lastFix ?? null,
    savedRideId: draft?.savedRideId ?? null,
    start: (fix: LocationFix | null, plan: RecordingPlan, discard = false) =>
      rideRecording.start(owner, fix, plan, discard),
    async stop() {
      const stopped = await rideRecording.stop(owner);
      return {
        durationSec: stopped
          ? Math.max(
              0,
              Math.floor(
                ((stopped.endedMs ?? Date.now()) - stopped.startedMs) / 1000,
              ),
            )
          : 0,
        endedAt: new Date(stopped?.endedMs ?? Date.now()).toISOString(),
        startedAt: stopped ? new Date(stopped.startedMs).toISOString() : null,
        distanceKm: stopped?.km ?? 0,
        coordinates: stopped ? [...stopped.points] : [],
        plan: stopped?.plan ?? null,
      };
    },
    markSaved: (id: string) => rideRecording.markSaved(owner, id),
    clear: () => rideRecording.clear(owner),
    retry: () => rideRecording.restore(owner),
  };
}
