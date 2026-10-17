import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import type { CyclingRoute } from "@cycling/contracts";
import {
  Page,
  H1,
  Subtitle,
  Panel,
  PrimaryButton,
  Busy,
  Notice,
} from "../../../shared/components/UI";
import { AppText } from "../../../shared/components/DesignSystem";
import { routesService } from "../services/routes.service";
import { CyclingMap } from "../../maps/components/CyclingMap";
import { useAuth } from "../../auth/context/AuthContext";
import { setRepeatRide } from "../../navigation/services/repeat-ride.store";
import { setPlannedRide } from "../../navigation/services/planned-ride.store";
import { validCoordinate } from "../../maps/utils/geometry";
export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(),
    { user } = useAuth();
  const [route, setRoute] = useState<CyclingRoute | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let current = true;
    setRoute(null);
    setError("");
    if (id)
      void routesService
        .get(id)
        .then((value) => {
          if (current) setRoute(value);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
    return () => {
      current = false;
    };
  }, [id]);
  const plan = () => {
    if (!user) {
      router.push("/auth");
      return;
    }
    const destination = route?.coordinates.at(-1);
    if (!route || route.isDemo || !destination || !validCoordinate(destination))
      return;
    setRepeatRide({
      userId: user.id,
      destination: {
        id: `saved-route:${route.id}`,
        label: route.title,
        coordinate: destination,
      },
    });
    router.push("/explore");
  };
  return (
    <Page>
      {route ? (
        <View style={{ gap: 18 }}>
          <H1>{route.title}</H1>
          <Subtitle>{route.description}</Subtitle>
          <CyclingMap routes={[route]} showUser={false} height={340} />
          <Panel>
            <AppText weight="bold">
              {route.distanceKm} km · {route.durationMin} min
            </AppText>
            <AppText>Desnivel estimado: {route.ascentM} m</AppText>
          </Panel>
          {route.isDemo ? (
            <Notice message="Esta ruta es un trazado sintético de prueba y no se usa para navegación real." />
          ) : (
            <>
              <PrimaryButton
                title="Planificar desde mi ubicación →"
                disabled={!route.coordinates.length}
                onPress={plan}
              />
              <AppText>
                Calcularemos una ruta ciclista al destino guardado desde tu
                ubicación actual. Al iniciar podrás abrir la navegación en vivo.
              </AppText>
            </>
          )}
          <PrimaryButton
            title="Registrar una salida libre"
            outline
            onPress={() => {
              setPlannedRide(null);
              router.replace("/ride");
            }}
          />
        </View>
      ) : error ? (
        <Notice message={error} />
      ) : (
        <Busy />
      )}
    </Page>
  );
}
