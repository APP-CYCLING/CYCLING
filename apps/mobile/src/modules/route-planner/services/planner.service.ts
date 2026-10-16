import type { Coordinate, Destination, PlannedRoute } from "@cycling/contracts";
import { callMapFunction } from "../../../shared/services/map-functions";
export const plannerService = {
  calculate: (
    origin: Coordinate,
    destination: Coordinate,
    signal?: AbortSignal,
  ) =>
    callMapFunction<PlannedRoute>(
      "calculate-bike-route",
      { origin, destination },
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
