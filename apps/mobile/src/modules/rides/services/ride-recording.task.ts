import * as TaskManager from "expo-task-manager";
import type { LocationObject } from "expo-location";
import { RECORDING_TASK } from "./recording-store";
import { rideRecording } from "./ride-recording.service";

// Must be evaluated by the entry point, even in a headless background launch.
TaskManager.defineTask<{ locations: LocationObject[] }>(
  RECORDING_TASK,
  async ({ data, error }) => {
    if (error) {
      rideRecording.report(
        new Error(
          "El GPS informó un error. Revisa la ubicación y los permisos del teléfono.",
        ),
      );
      return;
    }
    try {
      await rideRecording.append(data?.locations ?? []);
    } catch (cause) {
      rideRecording.report(cause);
    }
  },
);
