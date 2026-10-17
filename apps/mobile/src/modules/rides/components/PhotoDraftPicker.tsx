import React, { useState } from "react";
import { Image, View } from "react-native";
import { AppText } from "../../../shared/components/DesignSystem";
import { Notice, PrimaryButton } from "../../../shared/components/UI";
import {
  pickRidePhotos,
  type DraftPhoto,
} from "../services/ride-photos.service";
export function PhotoDraftPicker({
  photos,
  onChange,
  disabled = false,
  limit = 6,
}: {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  disabled?: boolean;
  limit?: number;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pick = async () => {
    setBusy(true);
    setError("");
    try {
      onChange([...photos, ...(await pickRidePhotos(limit - photos.length))]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir la galería.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 12 }}>
      <AppText weight="bold">Fotos de la actividad (opcional)</AppText>
      <AppText style={{ fontSize: 12 }}>
        Hasta 6 fotos privadas · JPG, PNG o WebP · 5 MB por foto.
      </AppText>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {photos.map((photo) => (
          <View key={photo.id} style={{ width: 110, gap: 5 }}>
            <Image
              source={{ uri: photo.uri }}
              accessibilityLabel="Foto seleccionada"
              style={{ width: 110, height: 100, borderRadius: 12 }}
            />
            <PrimaryButton
              title="Quitar"
              outline
              disabled={disabled || busy}
              onPress={() =>
                onChange(photos.filter((item) => item.id !== photo.id))
              }
            />
          </View>
        ))}
      </View>
      {!!error && <Notice message={error} />}
      {photos.length < limit && (
        <PrimaryButton
          title={busy ? "Abriendo galería…" : "Añadir fotos"}
          outline
          disabled={disabled || busy}
          onPress={() => void pick()}
        />
      )}
    </View>
  );
}
