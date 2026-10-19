export type ThemeScheme = "light" | "dark";
const KEY = "cycling:appearance:v1";
type Storage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};
type Preference = {
  scheme: ThemeScheme;
  ready: boolean;
  saving: boolean;
  error: string;
};

export class ThemePreference {
  private state: Preference = {
    scheme: "light",
    ready: false,
    saving: false,
    error: "",
  };
  private listeners = new Set<() => void>();
  private revision = 0;
  private loading: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  constructor(private storage: Storage) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(value: Partial<Preference>) {
    this.state = { ...this.state, ...value };
    this.listeners.forEach((listener) => listener());
  }
  restore = () => {
    if (this.loading) return this.loading;
    const revision = this.revision;
    this.loading = this.storage
      .getItem(KEY)
      .then((value) => {
        if (revision === this.revision)
          this.update({
            scheme: value === "dark" ? "dark" : "light",
            ready: true,
          });
      })
      .catch(() => {
        if (revision === this.revision)
          this.update({
            ready: true,
            error:
              "No se pudo recuperar tu preferencia. Se está usando el modo claro.",
          });
      });
    return this.loading;
  };
  setDarkMode = (enabled: boolean) => {
    const scheme = enabled ? "dark" : "light";
    const revision = ++this.revision;
    this.update({ scheme, ready: true, saving: true, error: "" });
    this.writes = this.writes
      .then(() => this.storage.setItem(KEY, scheme))
      .then(() => {
        if (revision === this.revision) this.update({ saving: false });
      })
      .catch(() => {
        if (revision === this.revision)
          this.update({
            saving: false,
            error:
              "El tema se aplicó, pero no se pudo guardar. Vuelve a seleccionar tu preferencia para reintentar.",
          });
      });
    return this.writes;
  };
}
