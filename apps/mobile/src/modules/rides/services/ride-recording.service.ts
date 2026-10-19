import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Alert, AppState, Platform } from "react-native";
import { RecordingStore, RECORDING_TASK } from "./recording-store";

export const rideRecording = new RecordingStore(AsyncStorage, {
  async requestPermission() {
    if (Platform.OS === "web" || !(await TaskManager.isAvailableAsync()))
      throw new Error(
        "La grabación en segundo plano requiere una APK actualizada de CYCLING.",
      );
    if (AppState.currentState !== "active")
      throw new Error("Abre CYCLING para iniciar la grabación del recorrido.");
    if (!(await Location.hasServicesEnabledAsync()))
      throw new Error(
        "Activa la ubicación del teléfono para grabar tu recorrido.",
      );
    let foreground = await Location.getForegroundPermissionsAsync();
    if (!foreground.granted)
      foreground = await Location.requestForegroundPermissionsAsync();
    if (!foreground.granted)
      throw new Error("Permite el acceso a tu ubicación para grabar.");
    let background = await Location.getBackgroundPermissionsAsync();
    if (!background.granted) {
      const accepted = await new Promise<boolean>((resolve) =>
        Alert.alert(
          "Grabar con la pantalla apagada",
          "CYCLING usará tu ubicación durante el recorrido aunque bloquees la pantalla o uses otra app. Permite el acceso «Siempre» o «Permitir todo el tiempo» en los ajustes que aparecerán. El registro termina cuando pulses Finalizar.",
          [
            {
              text: "Cancelar",
              style: "cancel",
              onPress: () => resolve(false),
            },
            { text: "Continuar", onPress: () => resolve(true) },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        ),
      );
      if (!accepted)
        throw new Error(
          "No se inició el recorrido. Necesitas permitir la ubicación en segundo plano.",
        );
      background = await Location.requestBackgroundPermissionsAsync();
    }
    if (!background.granted)
      throw new Error(
        "En Ajustes → Apps → CYCLING → Ubicación, selecciona «Permitir todo el tiempo» y Ubicación precisa. Después vuelve a iniciar el recorrido.",
      );
  },
  async start() {
    if (AppState.currentState !== "active")
      throw new Error(
        "Vuelve a CYCLING y pulsa iniciar para activar el registro GPS.",
      );
    await Location.startLocationUpdatesAsync(RECORDING_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 0,
      deferredUpdatesInterval: 0,
      deferredUpdatesDistance: 0,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "CYCLING está grabando tu recorrido",
        notificationBody:
          "GPS activo en segundo plano. Abre CYCLING para finalizar y guardar.",
        notificationColor: "#A7F55B",
        killServiceOnDestroy: false,
      },
    });
  },
  async stop() {
    if (
      Platform.OS !== "web" &&
      (await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))
    )
      await Location.stopLocationUpdatesAsync(RECORDING_TASK);
  },
  isStarted: () =>
    Platform.OS === "web"
      ? Promise.resolve(false)
      : Location.hasStartedLocationUpdatesAsync(RECORDING_TASK),
});
