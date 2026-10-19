import type {
  Coordinate,
  Destination,
  PlannedRoute,
  RouteMode,
  RouteCalculation,
} from "@cycling/contracts";
import { callMapFunction } from "../../../shared/services/map-functions";
export const plannerService = {
  fast: (origin: Coordinate, destination: Coordinate, signal?: AbortSignal) =>
    callMapFunction<RouteCalculation>(
      "calculate-bike-route",
      { origin, destination, phase: "fast" },
      signal,
    ),
  complete: (
    origin: Coordinate,
    destination: Coordinate,
    calculationId: string,
    signal?: AbortSignal,
  ) =>
    callMapFunction<PlannedRoute>(
      "calculate-bike-route",
      { origin, destination, calculationId, alternatives: true },
      signal,
    ),
  calculate: (
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal,
    mode?: RouteMode,
  ) =>
    callMapFunction<PlannedRoute>(
      "calculate-bike-route",
      {
        origin,
        destination,
        ...(mode && mode !== "fast" ? { alternatives: true, mode } : {}),
      },
      signal,
    ),
  alternatives: (
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal,
  ) =>
    callMapFunction<PlannedRoute>(
      "calculate-bike-route",
      { origin, destination, alternatives: true },
      signal,
    ),
  async search(
    text: string,
    proximity?: Coordinate | null,
    signal?: AbortSignal,
  ): Promise<Destination[]> {
    const data = await callMapFunction<{ destinations: Destination[] }>(
      "search-destinations",
      { text, proximity },
      signal,
    );
    return data.destinations;
  },
};
