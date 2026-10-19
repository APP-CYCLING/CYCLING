import React, { lazy, Suspense, useCallback, useRef, useState } from "react";
import { Alert, Image, Modal, Pressable, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText, ScreenHeader } from "../../../shared/components/DesignSystem";
import {
  Page,
  Panel,
  PrimaryButton,
  Notice,
  Busy,
} from "../../../shared/components/UI";
import { useThemeColors } from "../../../shared/theme/ThemeContext";
import { useAuth } from "../../auth/context/AuthContext";
import {
  albumsService,
  type Album,
  type AlbumItem,
} from "../services/albums.service";
import {
  pickMedia,
  type MediaDraft,
} from "../../../shared/services/media-upload";
const Video = lazy(() =>
  import("../components/AlbumVideo").then((module) => ({
    default: module.AlbumVideo,
  })),
);
class PlaybackBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <Notice message="No se pudo abrir el reproductor. Instala la nueva APK y actualiza el álbum para reintentar." />
    ) : (
      this.props.children
    );
  }
}
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("es", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
export default function AlbumsScreen() {
  const { user } = useAuth(),
    colors = useThemeColors();
  const [albums, setAlbums] = useState<Album[]>([]),
    [owner, setOwner] = useState(user?.id),
    [limit, setLimit] = useState(50),
    [more, setMore] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [title, setTitle] = useState(""),
    [creating, setCreating] = useState(false),
    [showCreate, setShowCreate] = useState(false),
    [selected, setSelected] = useState<Album | null>(null);
  const request = useRef(0),
    creatingRef = useRef(false),
    identity = useRef(user?.id);
  identity.current = user?.id;
  const load = useCallback(async () => {
    const generation = ++request.current;
    setLoading(true);
    setError("");
    try {
      const data = await albumsService.list(limit, user?.id);
      if (generation === request.current && identity.current === user?.id) {
        setOwner(user?.id);
        setAlbums(data.albums);
        setMore(data.hasMore);
        setError(data.notice);
      }
    } catch (e) {
      if (generation === request.current)
        setError(
          e instanceof Error ? e.message : "No se pudieron cargar tus álbumes.",
        );
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }, [user?.id, limit]);
  useFocusEffect(
    useCallback(() => {
      setAlbums([]);
      setSelected(null);
      setTitle("");
      setShowCreate(false);
      if (user) void load();
      return () => {
        request.current++;
      };
    }, [load]),
  );
  const create = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError("");
    const owner = user?.id;
    try {
      const album = await albumsService.create(title, owner);
      if (identity.current !== owner) return;
      setTitle("");
      setShowCreate(false);
      setOwner(owner);
      setSelected(album);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el álbum.");
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title="Álbumes"
        back={() =>
          router.canGoBack() ? router.back() : router.replace("/profile")
        }
      />
      <Page>
        <AppText style={{ color: colors.muted }}>
          Agrupa tus fotos y videos por salida o momento, con o sin un recorrido
          registrado.
        </AppText>
        {!user ? (
          <PrimaryButton
            title="Iniciar sesión"
            onPress={() => router.push("/auth")}
          />
        ) : (
          <>
            <PrimaryButton
              title={showCreate ? "Cancelar nuevo álbum" : "Crear álbum +"}
              disabled={creating}
              onPress={() => setShowCreate((v) => !v)}
            />
            {showCreate && (
              <Panel>
                <AppText weight="bold">Nombre del álbum</AppText>
                <TextInput
                  accessibilityLabel="Nombre del álbum"
                  placeholder="Salida por la playa"
                  placeholderTextColor={colors.muted}
                  maxLength={80}
                  editable={!creating}
                  value={title}
                  onChangeText={setTitle}
                  style={{ minHeight: 48, color: colors.text, fontSize: 16 }}
                />
                <PrimaryButton
                  title={creating ? "Creando…" : "Crear y añadir archivos"}
                  disabled={creating || !title.trim()}
                  onPress={() => void create()}
                />
              </Panel>
            )}
            {loading && <Busy />}
            {!!error && <Notice message={error} />}
            {!loading && !albums.length && !error && (
              <Panel>
                <AppText weight="bold">Tus recuerdos empiezan aquí</AppText>
                <AppText>
                  Crea un álbum o añade fotos a un recorrido desde Actividad.
                </AppText>
              </Panel>
            )}
            {(owner === user.id ? albums : []).map((album) => (
              <Pressable
                accessibilityRole="button"
                key={`${album.kind}:${album.id}`}
                onPress={() => setSelected(album)}
              >
                <Panel
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <View
                    style={{
                      height: 54,
                      width: 54,
                      borderRadius: 16,
                      backgroundColor: colors.softGreen,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons
                      name={
                        album.kind === "ride"
                          ? "bicycle-outline"
                          : "albums-outline"
                      }
                      size={27}
                      color={colors.greenDark}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 5 }}>
                    <AppText weight="bold" style={{ fontSize: 17 }}>
                      {album.title}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: colors.muted }}>
                      {album.kind === "ride" ? "Recorrido" : "Creado"} ·{" "}
                      {dateLabel(album.createdAt)}
                    </AppText>
                    <AppText style={{ fontSize: 12, color: colors.muted }}>
                      {album.kind === "ride"
                        ? "Fotos de tu actividad"
                        : `${album.count ?? 0} archivos · Fotos y videos`}
                    </AppText>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={colors.muted}
                  />
                </Panel>
              </Pressable>
            ))}
            {more && (
              <PrimaryButton
                title="Cargar más álbumes"
                outline
                disabled={loading}
                onPress={() => setLimit((n) => n + 50)}
              />
            )}
            <PrimaryButton
              title="Actualizar álbumes"
              outline
              disabled={loading}
              onPress={() => void load()}
            />
          </>
        )}
      </Page>
      {!!selected && !!user && owner === user.id && (
        <AlbumDetail
          key={`${user.id}:${selected.kind}:${selected.id}`}
          initial={selected}
          onClose={() => {
            setSelected(null);
            void load();
          }}
        />
      )}
    </SafeAreaView>
  );
}
function AlbumDetail({
  initial,
  onClose,
}: {
  initial: Album;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const [album, setAlbum] = useState(initial),
    [name, setName] = useState(initial.title),
    [items, setItems] = useState<AlbumItem[]>([]),
    [drafts, setDrafts] = useState<MediaDraft[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState<string | null>(null);
  const active = useRef(true),
    inFlight = useRef(false),
    done = useRef(new Set<string>());
  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const value = await albumsService.items(album);
      if (active.current) setItems(value);
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "No se pudo abrir el álbum.");
    } finally {
      if (active.current) setLoading(false);
    }
  }, [album.id, album.kind]);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      void refresh();
      return () => {
        active.current = false;
      };
    }, [refresh]),
  );
  const close = () => {
    if (inFlight.current) return;
    if (drafts.length || name.trim() !== album.title)
      Alert.alert(
        "¿Salir del álbum?",
        "Los cambios pendientes todavía no se han guardado.",
        [
          { text: "Seguir editando", style: "cancel" },
          { text: "Salir", onPress: onClose },
        ],
      );
    else onClose();
  };
  const work = async (task: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : "No se pudo guardar. Reintenta.",
        );
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const add = () =>
    void work(async () => {
      const remaining = Math.min(10, 30 - items.length - drafts.length);
      if (remaining <= 0)
        throw new Error("Puedes añadir hasta 30 archivos por álbum.");
      const value = await pickMedia({ remaining });
      if (active.current) setDrafts((old) => [...old, ...value]);
    });
  const save = () =>
    void work(async () => {
      if (name.trim() !== album.title) {
        const updated = await albumsService.rename(album, name);
        if (active.current) {
          setAlbum(updated);
          setName(updated.title);
        }
      }
      await albumsService.upload(album, drafts, done.current);
      if (active.current) {
        setDrafts([]);
        done.current.clear();
        await refresh();
      }
    });
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenHeader title="Tu álbum" back={close} />
        <Page>
          <AppText weight="heavy" style={{ fontSize: 24 }}>
            {album.title}
          </AppText>
          <AppText style={{ fontSize: 12, color: colors.muted }}>
            {dateLabel(album.createdAt)} ·{" "}
            {album.kind === "ride" ? "Fotos del recorrido" : "Álbum privado"}
          </AppText>
          {album.kind === "album" && (
            <Panel>
              <AppText weight="bold">Nombre</AppText>
              <TextInput
                accessibilityLabel="Cambiar nombre del álbum"
                value={name}
                onChangeText={setName}
                maxLength={80}
                editable={!busy}
                style={{ minHeight: 48, color: colors.text }}
              />
              <PrimaryButton
                title="Añadir fotos o videos"
                outline
                disabled={busy || loading || done.current.size > 0}
                onPress={add}
              />
              <AppText style={{ fontSize: 11, color: colors.muted }}>
                Fotos hasta 5 MB · Videos hasta 25 MB y un minuto · 30 archivos
                por álbum.
              </AppText>
            </Panel>
          )}
          {loading && <Busy />}
          {!!error && <Notice message={error} />}
          {!loading && !items.length && !drafts.length && !error && (
            <AppText>Este álbum todavía no tiene archivos.</AppText>
          )}
          {items.map((item) => (
            <View key={item.id} style={{ gap: 8 }}>
              {item.type === "image" ? (
                <Image
                  source={{ uri: item.url }}
                  accessibilityLabel="Foto del álbum"
                  resizeMode="contain"
                  style={{
                    height: 270,
                    width: "100%",
                    borderRadius: 18,
                    backgroundColor: colors.surfaceLow,
                  }}
                  onError={() =>
                    setError("No se pudo abrir una foto. Actualiza el álbum.")
                  }
                />
              ) : playing === item.id ? (
                <PlaybackBoundary key={item.url}>
                  <Suspense fallback={<Busy />}>
                    <Video url={item.url} />
                  </Suspense>
                </PlaybackBoundary>
              ) : (
                <PrimaryButton
                  title="Reproducir video ▶"
                  outline
                  onPress={() => setPlaying(item.id)}
                />
              )}
            </View>
          ))}
          {!!drafts.length && (
            <AppText weight="bold">
              Pendientes de guardar ({drafts.length})
            </AppText>
          )}
          {drafts.map((asset) => (
            <Panel key={asset.id}>
              {asset.type === "image" ? (
                <Image
                  source={{ uri: asset.uri }}
                  accessibilityLabel="Foto pendiente"
                  style={{ height: 160, width: "100%", borderRadius: 12 }}
                />
              ) : (
                <AppText>Video seleccionado · pendiente de guardar</AppText>
              )}
              {!done.current.has(asset.id) && (
                <PrimaryButton
                  title="Quitar de la selección"
                  outline
                  disabled={busy}
                  onPress={() =>
                    setDrafts((old) => old.filter((p) => p.id !== asset.id))
                  }
                />
              )}
            </Panel>
          ))}
          {album.kind === "album" && (
            <PrimaryButton
              title={
                busy
                  ? "Guardando…"
                  : error && drafts.length
                    ? "Reintentar guardado"
                    : "Guardar álbum"
              }
              disabled={
                busy ||
                loading ||
                (!drafts.length && name.trim() === album.title)
              }
              onPress={save}
            />
          )}
          <PrimaryButton
            title="Actualizar archivos"
            outline
            disabled={busy || loading}
            onPress={() => {
              setPlaying(null);
              void refresh();
            }}
          />
          {album.kind === "ride" && (
            <AppText style={{ fontSize: 12, color: colors.muted }}>
              Estas fotos pertenecen al recorrido guardado. Puedes añadir más
              desde su detalle en Actividad; aparecerán aquí automáticamente.
            </AppText>
          )}
        </Page>
      </SafeAreaView>
    </Modal>
  );
}
