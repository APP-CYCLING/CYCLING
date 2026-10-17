import React from "react";
import { useAuth } from "../../auth/context/AuthContext";
import { useMapPlanner } from "../hooks/useMapPlanner";
import { PlannerLayout } from "../components/PlannerLayout";
export function MapPlannerScreen() {
  const { user } = useAuth();
  return <Content key={user?.id ?? "guest"} />;
}
function Content() {
  return <PlannerLayout controller={useMapPlanner()} />;
}
