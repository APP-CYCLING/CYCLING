import React from "react";
import { useRideController } from "../hooks/useRideController";
import { RideLayout } from "../components/RideLayout";
import { useAuth } from "../../auth/context/AuthContext";
export default function RideScreen() {
  const { user } = useAuth();
  return <RideContent key={user?.id ?? "guest"} />;
}
function RideContent() {
  return <RideLayout controller={useRideController()} />;
}
