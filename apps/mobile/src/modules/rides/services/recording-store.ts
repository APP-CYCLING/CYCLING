import type { Coordinate, Destination, PlannedRoute } from "@cycling/contracts";
import type {
  LocationFix,
  LocationReading,
} from "../../geolocation/types/location.types";
import {
  canRecordFix,
  toLocationFix,
} from "../../geolocation/utils/location-policy";

export const RECORDING_TASK = "cycling-active-ride-location-v1";
const POINTER = "cycling:recording:owner:v1";
const key = (owner: string) => `cycling:recording:draft:v1:${owner}`;
export type RecordingPlan = {
  route: PlannedRoute;
  origin: Coordinate;
  destination: Destination;
  userId: string;
} | null;
export type RecordingDraft = {
  version: 1;
  owner: string;
  status: "active" | "stopped" | "interrupted";
  startedMs: number;
  endedMs: number | null;
  points: Coordinate[];
  km: number;
  lastFix: LocationFix;
  plan: RecordingPlan;
  savedRideId: string | null;
};
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};
type NativeRecorder = {
  requestPermission(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isStarted(): Promise<boolean>;
};
type Snapshot = {
  owner: string | null;
  draft: RecordingDraft | null;
  ready: boolean;
  busy: boolean;
  error: string;
};
function distance(a: Coordinate, b: Coordinate) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const h =
    Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 +
    Math.cos(rad(a.latitude)) *
      Math.cos(rad(b.latitude)) *
      Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** One serialized writer shared by the headless task and the mounted UI. */
export class RecordingStore {
  private state: Snapshot = {
    owner: null,
    draft: null,
    ready: false,
    busy: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private storage: Storage,
    private native: NativeRecorder,
    private now = Date.now,
  ) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(value: Partial<Snapshot>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }
  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.queue.then(operation);
    this.queue = next.catch(() => {});
    return next;
  }
  private async write(draft: RecordingDraft) {
    await this.storage.setItem(key(draft.owner), JSON.stringify(draft));
    this.publish({ owner: draft.owner, draft });
  }
  private async load(owner: string) {
    if (this.state.ready && this.state.owner === owner) return;
    const raw = await this.storage.getItem(key(owner));
    const draft: RecordingDraft | null = raw ? JSON.parse(raw) : null;
    if (
      draft &&
      (draft.version !== 1 ||
        draft.owner !== owner ||
        !["active", "stopped", "interrupted"].includes(draft.status) ||
        !Array.isArray(draft.points) ||
        !draft.lastFix ||
        !Number.isFinite(draft.startedMs) ||
        !Number.isFinite(draft.km))
    )
      throw new Error("No se pudo recuperar el borrador local del recorrido.");
    this.publish({ owner, draft, ready: true, error: "" });
  }
  private async interrupt(draft: RecordingDraft) {
    await this.write({
      ...draft,
      status: "interrupted",
      endedMs: Math.max(draft.startedMs, draft.lastFix.timestamp),
    });
    this.publish({
      error:
        "El teléfono interrumpió el GPS. Conservamos lo registrado hasta el último punto; puedes finalizar y guardarlo.",
    });
  }
  restore(owner: string) {
    return this.serialize(async () => {
      const previous = await this.storage.getItem(POINTER);
      if (previous && previous !== owner) {
        await this.load(previous);
        await this.native.stop();
        if (this.state.draft?.status === "active")
          await this.interrupt(this.state.draft);
        await this.storage.removeItem(POINTER);
      }
      await this.load(owner);
      const draft = this.state.draft;
      const registered = await this.native.isStarted();
      if (draft?.status !== "active" && registered) await this.native.stop();
      if (draft?.status === "active" && !registered)
        await this.interrupt(draft);
      else if (draft?.status === "interrupted")
        this.publish({
          error:
            "El teléfono interrumpió el GPS. Puedes guardar el recorrido recuperado.",
        });
    }).catch((error) => {
      this.report(error);
    });
  }
  start(
    owner: string,
    fix: LocationFix | null,
    plan: RecordingPlan,
    discard = false,
  ) {
    return this.serialize(async () => {
      this.publish({ busy: true, error: "" });
      try {
        const previous = await this.storage.getItem(POINTER);
        if (previous && previous !== owner)
          throw new Error("Espera a que termine la recuperación de tu cuenta antes de iniciar.");
        await this.load(owner);
        if (this.state.draft?.status === "active") return false;
        if (this.state.draft && !discard)
          throw new Error(
            "Guarda o descarta el recorrido anterior antes de iniciar otro.",
          );
        if (!canRecordFix(fix, this.now()))
          throw new Error(
            "Espera una ubicación GPS reciente y precisa antes de iniciar el recorrido.",
          );
        await this.native.requestPermission();
        if (!canRecordFix(fix, this.now()))
          throw new Error(
            "Permisos listos. Espera una ubicación GPS reciente y pulsa iniciar otra vez.",
          );
        // Permission dialogs can take a while. The seed is only an anchor; the
        // native service supplies all subsequent samples, including foreground.
        const draft: RecordingDraft = {
          version: 1,
          owner,
          status: "active",
          startedMs: this.now(),
          endedMs: null,
          points: [fix.coordinate],
          km: 0,
          lastFix: fix,
          plan,
          savedRideId: null,
        };
        await this.storage.setItem(POINTER, owner);
        await this.write(draft);
        try {
          await this.native.start();
        } catch (error) {
          await this.native.stop();
          await this.interrupt(draft);
          throw error;
        }
        return true;
      } catch (error) {
        this.report(error);
        return false;
      } finally {
        this.publish({ busy: false });
      }
    });
  }
  append(readings: LocationReading[]) {
    return this.serialize(async () => {
      const owner = await this.storage.getItem(POINTER);
      if (!owner) return;
      await this.load(owner);
      const draft = this.state.draft;
      if (!draft || draft.status !== "active") return;
      const points = [...draft.points];
      let lastFix = draft.lastFix,
        km = draft.km;
      for (const reading of [...readings].sort(
        (a, b) => a.timestamp - b.timestamp,
      )) {
        // Background batches can be older than the foreground freshness limit.
        // Validate each sample at its capture time, then reject replay/future data.
        const fix = toLocationFix(reading, reading.timestamp);
        if (
          !canRecordFix(fix, reading.timestamp) ||
          fix.timestamp <= lastFix.timestamp ||
          fix.timestamp < draft.startedMs ||
          fix.timestamp > this.now() + 5000
        )
          continue;
        const delta = distance(lastFix.coordinate, fix.coordinate);
        const elapsed = (fix.timestamp - lastFix.timestamp) / 1000;
        if (delta * 1000 > Math.max(40, elapsed * 20)) continue;
        points.push(fix.coordinate);
        km += delta;
        lastFix = fix;
      }
      if (lastFix === draft.lastFix) return;
      await this.write({ ...draft, points, km, lastFix });
      this.publish({ error: "" });
    });
  }
  stop(owner: string) {
    return this.serialize(async () => {
      const currentOwner = await this.storage.getItem(POINTER);
      if (currentOwner && currentOwner !== owner)
        throw new Error("La grabación pertenece a otra sesión. Vuelve a Pedalear con tu cuenta actual.");
      await this.load(owner);
      const draft = this.state.draft;
      await this.native.stop();
      if (!draft || draft.status !== "active") return draft;
      const stopped = {
        ...draft,
        status: "stopped" as const,
        endedMs: this.now(),
      };
      // Publish even if disk is full: the GPS is stopped and the in-memory track
      // remains available to save. A later restore detects the stopped service.
      this.publish({ draft: stopped });
      await this.write(stopped);
      return stopped;
    });
  }
  markSaved(owner: string, id: string) {
    return this.serialize(async () => {
      await this.load(owner);
      if (this.state.draft)
        await this.write({ ...this.state.draft, savedRideId: id });
    });
  }
  clear(owner: string) {
    return this.serialize(async () => {
      await this.load(owner);
      if (this.state.draft?.status === "active")
        throw new Error("Finaliza el recorrido antes de descartarlo.");
      await this.storage.removeItem(key(owner));
      if ((await this.storage.getItem(POINTER)) === owner)
        await this.storage.removeItem(POINTER);
      this.publish({ draft: null, error: "" });
    });
  }
  report(error: unknown) {
    this.publish({
      error:
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el registro GPS del recorrido.",
    });
  }
}
