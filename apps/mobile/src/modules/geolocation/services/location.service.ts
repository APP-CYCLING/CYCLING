import * as Location from "expo-location";
import type { LocationProvider } from "../types/location.types";

let permissionRequest: Promise<Location.LocationPermissionResponse> | null =
  null;
export const locationService: LocationProvider = {
  async permission() {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted || !existing.canAskAgain) return existing;
    // Compartir el diálogo si se cambia de pantalla mientras el SO lo muestra.
    if (!permissionRequest)
      permissionRequest = Location.requestForegroundPermissionsAsync().finally(
        () => {
          permissionRequest = null;
        },
      );
    return permissionRequest;
  },
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  lastKnown: () =>
    Location.getLastKnownPositionAsync({
      maxAge: 15000,
      requiredAccuracy: 1500,
    }),
  current: () =>
    Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
      mayShowUserSettingsDialog: true,
    }),
  watch: (onFix, onError) =>
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 3000,
        mayShowUserSettingsDialog: false,
      },
      onFix,
      onError,
    ),
};
