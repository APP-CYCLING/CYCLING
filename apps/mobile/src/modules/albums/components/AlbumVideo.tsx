import React from "react";
import { View } from "react-native";
import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import { AppText } from "../../../shared/components/DesignSystem";
export function AlbumVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url);
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });
  return (
    <View style={{ gap: 6 }}>
      <VideoView
        player={player}
        nativeControls
        contentFit="contain"
        style={{
          height: 250,
          width: "100%",
          backgroundColor: "#0F1210",
          borderRadius: 16,
        }}
        fullscreenOptions={{ enable: true }}
      />
      {status === "loading" && <AppText>Cargando video…</AppText>}
      {!!error && (
        <AppText>
          No se pudo reproducir el video. Actualiza el álbum para renovar el
          acceso.
        </AppText>
      )}
    </View>
  );
}
