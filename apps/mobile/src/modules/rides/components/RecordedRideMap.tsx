import React from "react";
import { View } from "react-native";
import type { Ride } from "@cycling/contracts";
import { CyclingMap } from "../../maps/components/CyclingMap";
import { geometryPoints, validCoordinate } from "../../maps/utils/geometry";
import { AppText } from "../../../shared/components/DesignSystem";
import { Notice } from "../../../shared/components/UI";
export function rideStatusLabel(ride: Ride) {
  return {
    completed: "Destino alcanzado · estimación GPS",
    incomplete: "Recorrido incompleto",
    unplanned: "Recorrido libre",
    unknown: "Sin información de llegada",
  }[ride.completionStatus ?? "unknown"];
}
export function RecordedRideMap({
  ride,
  height = 200,
}: {
  ride: Ride;
  height?: number;
}) {
  const geometry = ride.plannedRoute?.geometry;
  const first = geometryPoints(geometry)[0];
  const track = ride.coordinates.filter(validCoordinate);
  const stop = ride.stopPosition ?? track.at(-1);
  if (!geometry && !track.length)
    return (
      <Notice message="Este recorrido no tiene un trazado GPS disponible." />
    );
  return (
    <View style={{ gap: 8 }}>
      <CyclingMap
        height={height}
        currentLocation={null}
        showUser={false}
        geometry={geometry}
        tracked={track}
        minimumSpan={0.003}
        initialFocus="route"
        origin={first ? { longitude: first[0], latitude: first[1] } : track[0]}
        destination={ride.destination}
        stopPosition={stop}
        stopLabel="Última ubicación GPS registrada"
      />
      <AppText style={{ fontSize: 11, lineHeight: 17 }}>
        {geometry
          ? "Lima: ruta prevista · Azul: recorrido GPS · "
          : "Azul: recorrido GPS · "}
        Naranja: aquí terminaste.
        {!geometry ? " No se guardó una ruta prevista para esta salida." : ""}
      </AppText>
    </View>
  );
}
