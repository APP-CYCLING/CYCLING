let speech: Promise<typeof import("expo-speech")> | null = null;
let generation = 0;
export async function announce(text: string) {
  const id = ++generation;
  speech ??= import("expo-speech");
  try {
    const module = await speech;
    if (id !== generation) return;
    await module.stop();
    if (id === generation)
      await new Promise<void>((resolve, reject) =>
        module.speak(text, {
          language: "es-PE",
          rate: 0.95,
          onDone: resolve,
          onStopped: resolve,
          onError: reject,
        }),
      );
  } catch {
    speech = null;
    throw new Error(
      "La voz no está disponible. Instala una nueva compilación con expo-speech o continúa con las indicaciones en pantalla.",
    );
  }
}
export function stopAnnouncements() {
  generation++;
  if (speech) void speech.then((module) => module.stop()).catch(() => {});
}
