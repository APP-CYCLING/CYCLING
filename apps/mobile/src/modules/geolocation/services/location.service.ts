import * as Location from "expo-location";
import type { Coordinate } from "@cycling/contracts";
import { validCoordinate } from "../../maps/utils/geometry";

export function usablePosition(
  location: Location.LocationObject,
): Coordinate | null {
  const point = {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
  if (
    !validCoordinate(point) ||
    location.coords.accuracy == null ||
    location.coords.accuracy > 100 ||
    Date.now() - location.timestamp > 30000
  )
    return null;
  return point;
}
export const locationService = {
  async requestPermission() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted)
      throw new Error(
        "Permiso denegado. Puedes elegir el origen tocando el mapa o habilitar la ubicación en Ajustes.",
      );
    if (!(await Location.hasServicesEnabledAsync()))
      throw new Error(
        "El GPS está desactivado. Actívalo o selecciona un origen en el mapa.",
      );
  },
  watch: (onLocation: (position: Coordinate | null) => void) =>
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 0,
        timeInterval: 5000,
      },
      (location) => onLocation(usablePosition(location)),
    ),
};
