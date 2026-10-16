import type { Bounds, LaneCollection } from "@cycling/contracts";
import { callMapFunction } from "../../../shared/services/map-functions";
import { areaKey } from "../../maps/utils/geometry";

const cache = new Map<string, { expires: number; data: LaneCollection }>();
export const osmLanesService = {
  async list(bounds: Bounds, signal?: AbortSignal): Promise<LaneCollection> {
    const key = areaKey(bounds),
      hit = cache.get(key);
    if (hit && hit.expires > Date.now()) return hit.data;
    const data = await callMapFunction<LaneCollection>(
      "get-bike-lanes",
      { bounds },
      signal,
    );
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(key, { expires: Date.now() + 5 * 60000, data });
    return data;
  },
};
