import { useEffect, useState } from "react";
import { Keyboard } from "react-native";
import { router } from "expo-router";
import type {
  Bounds,
  Coordinate,
  Destination,
  LaneFeature,
} from "@cycling/contracts";
import { useScreenFocused } from "../../../shared/hooks/useScreenFocused";
import { useUserLocation } from "../../geolocation/hooks/useUserLocation";
import { useRoutePlanner } from "../../route-planner/hooks/useRoutePlanner";
import { useDestinationSearch } from "../../route-planner/hooks/useDestinationSearch";
import { useVisibleBikeLanes } from "../../bike-lanes/hooks/useVisibleBikeLanes";
import { useAuth } from "../../auth/context/AuthContext";
import { setPlannedRide } from "../../navigation/services/planned-ride.store";
import {
  useRepeatRide,
  setRepeatRide,
} from "../../navigation/services/repeat-ride.store";
const pointLabel = (p: Coordinate) =>
  `${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`;
export function useMapPlanner() {
  const { user } = useAuth(),
    focused = useScreenFocused(),
    gps = useUserLocation();
  const [manualOrigin, setManualOrigin] = useState<Coordinate | null>(null),
    [originMode, setOriginMode] = useState<"gps" | "manual">("gps"),
    [target, setTarget] = useState<"origin" | "destination">("destination");
  const [query, setQuery] = useState(""),
    [bounds, setBounds] = useState<Bounds | null>(null),
    [showLanes, setShowLanes] = useState(true);
  const [centerRequest, setCenterRequest] = useState(0),
    [fitRequest, setFitRequest] = useState(0),
    [lane, setLane] = useState<LaneFeature | null>(null);
  const origin = originMode === "gps" ? gps.position : manualOrigin;
  const planner = useRoutePlanner(origin);
  const repeat = useRepeatRide(user?.id);
  useEffect(() => {
    if (!focused || !repeat) return;
    setOriginMode("gps");
    setManualOrigin(null);
    setTarget("destination");
    planner.select(repeat.destination);
    setQuery(repeat.destination.label);
    setCenterRequest((value) => value + 1);
    gps.request();
    setRepeatRide(null);
  }, [focused, repeat]);
  const displayedOrigin = planner.routeOrigin ?? origin;
  const search = useDestinationSearch(
    query,
    origin ?? gps.position,
    !!user && !planner.destination && focused,
  );
  const lanes = useVisibleBikeLanes(bounds, showLanes && !!user && focused);
  useEffect(() => {
    if (focused) setCenterRequest((value) => value + 1);
  }, [focused]);
  const select = (destination: Destination) => {
    planner.select(destination);
    setQuery(destination.label);
    setTarget("destination");
    setLane(null);
    Keyboard.dismiss();
  };
  const pick = (point: Coordinate) => {
    Keyboard.dismiss();
    setLane(null);
    if (target === "origin") {
      setManualOrigin(point);
      setOriginMode("manual");
      planner.cancel();
      setTarget("destination");
    } else
      select({
        id: `map:${point.longitude},${point.latitude}`,
        label: `Punto en el mapa · ${pointLabel(point)}`,
        coordinate: point,
      });
  };
  const locate = () => {
    if (originMode !== "gps") planner.cancel();
    setOriginMode("gps");
    setTarget("destination");
    setCenterRequest((value) => value + 1);
    if (!gps.position || gps.status === "error") gps.request();
  };
  const begin = () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    if (!planner.routeOrigin || !planner.route || !planner.destination) return;
    setPlannedRide({
      origin: planner.routeOrigin,
      route: planner.route,
      destination: planner.destination,
      userId: user.id,
    });
    router.push({
      pathname: "/ride",
      params: { start: Date.now().toString() },
    });
  };
  return {
    user,
    gps,
    origin,
    originMode,
    target,
    setTarget,
    query,
    setQuery,
    showLanes,
    setShowLanes,
    centerRequest,
    fitRequest,
    setFitRequest,
    lane,
    setLane,
    planner,
    displayedOrigin,
    search,
    lanes,
    select,
    pick,
    locate,
    begin,
    setBounds,
  };
}
