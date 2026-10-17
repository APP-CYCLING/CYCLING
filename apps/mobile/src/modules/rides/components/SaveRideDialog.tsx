import React from "react";
import { PhotoDraftPicker } from "./PhotoDraftPicker";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { useRideController } from "../hooks/useRideController";
import { AppText, IconButton } from "../../../shared/components/DesignSystem";
import { Field, Notice, PrimaryButton } from "../../../shared/components/UI";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
export function SaveRideDialog({
  controller: c,
}: {
  controller: ReturnType<typeof useRideController>;
}) {
  const colors = useThemeColors();

  return (
    <Modal
      visible={c.saveDialogOpen}
      animationType="slide"
      onRequestClose={c.closeSaveDialog}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={{
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <IconButton
              icon="close"
              label="Guardar más tarde"
              onPress={c.closeSaveDialog}
            />
            <AppText weight="bold" style={{ fontSize: 20 }}>
              Guardar recorrido
            </AppText>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: 20,
              gap: 20,
              maxWidth: 760,
              width: "100%",
              alignSelf: "center",
            }}
          >
            <AppText style={{ color: colors.muted, lineHeight: 22 }}>
              Tu registro ha finalizado. Ponle un nombre para encontrarlo
              fácilmente.
            </AppText>
            <Field
              label="Nombre del recorrido (opcional)"
              value={c.rideName}
              onChangeText={c.setRideName}
              placeholder="Ej. Mi vuelta por el malecón"
              maxLength={160}
              editable={!c.saving && !c.rideAlreadySaved}
              autoCapitalize="sentences"
            />
            <View
              style={{
                padding: 18,
                backgroundColor: colors.surface,
                borderRadius: 20,
                gap: 10,
              }}
            >
              <AppText weight="bold">
                Si lo dejas vacío, se guardará como:
              </AppText>
              <AppText style={{ lineHeight: 22, color: colors.greenDark }}>
                {c.automaticName}
              </AppText>
              <AppText
                style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
              >
                Usamos el destino elegido, la fecha de llegada y el momento del
                día. Si no elegiste un destino, usamos «Recorrido libre».
              </AppText>
            </View>
            <PhotoDraftPicker
              photos={c.photos}
              onChange={c.setPhotos}
              disabled={c.saving || c.rideAlreadySaved}
            />
            {c.rideAlreadySaved && (
              <Notice message="El recorrido ya está guardado. Reintenta para completar la carga de fotos sin duplicar la actividad." />
            )}
            {!!c.saveError && <Notice message={c.saveError} />}
            <PrimaryButton
              title={c.saving ? "Guardando…" : "Guardar recorrido"}
              disabled={c.saving}
              onPress={() => void c.saveRide()}
            />
            <PrimaryButton
              title="Guardar más tarde"
              outline
              disabled={c.saving}
              onPress={c.closeSaveDialog}
            />
            <AppText
              style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}
            >
              Si sales de este formulario, podrás volver a abrirlo con «Guardar
              recorrido detenido». Mantén la app abierta hasta completar el
              guardado.
            </AppText>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
