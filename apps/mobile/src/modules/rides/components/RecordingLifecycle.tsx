import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuth } from "../../auth/context/AuthContext";
import { rideRecording } from "../services/ride-recording.service";

export function RecordingLifecycle() {
  const { user } = useAuth();
  const owner = user?.id ?? "guest";
  useEffect(() => {
    void rideRecording.restore(owner);
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") void rideRecording.restore(owner);
    });
    // Unmounting UI must never stop a recording. Account changes are handled
    // by restore, which suspends the previous owner's service and keeps its draft.
    return () => listener.remove();
  }, [owner]);
  return null;
}
