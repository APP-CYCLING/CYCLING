export const disciplines = [
  "Urbano / Commute",
  "Ruta / Carretera",
  "Gravel",
  "e-Bike",
] as const;
export const frequencies = [
  "Sin definir",
  "1–2 días por semana",
  "3–4 días por semana",
  "4–5 días por semana",
  "Diario (6–7 días)",
] as const;
export type CyclingProfile = {
  name: string;
  username: string;
  location: string;
  bio: string;
  discipline: (typeof disciplines)[number];
  frequency: (typeof frequencies)[number];
  weightKg: string;
  heightCm: string;
  bikeName: string;
  bikeType: string;
  monthlyGoalKm: string;
};
const text = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;
export function profileFromMetadata(
  name: string,
  metadata: Record<string, unknown>,
): CyclingProfile {
  const raw = metadata.cycling_profile;
  const p =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    name: text(metadata.name, name),
    username: text(p.username),
    location: text(p.location),
    bio: text(p.bio),
    discipline: disciplines.includes(
      p.discipline as (typeof disciplines)[number],
    )
      ? (p.discipline as (typeof disciplines)[number])
      : disciplines[0],
    frequency: frequencies.includes(p.frequency as (typeof frequencies)[number])
      ? (p.frequency as (typeof frequencies)[number])
      : frequencies[0],
    weightKg: text(p.weightKg),
    heightCm: text(p.heightCm),
    bikeName: text(p.bikeName),
    bikeType: text(p.bikeType),
    monthlyGoalKm: text(p.monthlyGoalKm, "250"),
  };
}
export function validateProfile(input: CyclingProfile): CyclingProfile {
  const result = Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      typeof value === "string" ? value.trim() : "",
    ]),
  ) as CyclingProfile;
  result.username = result.username.replace(/^@/, "");
  if (result.name.length < 2 || result.name.length > 80)
    throw new Error("Escribe un nombre de entre 2 y 80 caracteres.");
  if (result.username && !/^[a-zA-Z0-9_.]{3,30}$/.test(result.username))
    throw new Error(
      "El alias debe tener entre 3 y 30 letras, números, puntos o guiones bajos.",
    );
  if (
    result.location.length > 100 ||
    result.bio.length > 160 ||
    result.bikeName.length > 80 ||
    result.bikeType.length > 60
  )
    throw new Error("Revisa la longitud de tus datos de perfil.");
  if (
    !disciplines.includes(result.discipline) ||
    !frequencies.includes(result.frequency)
  )
    throw new Error("Elige una modalidad y frecuencia válidas.");
  for (const [field, min, max, label] of [
    ["weightKg", 20, 350, "peso (20–350 kg)"],
    ["heightCm", 80, 250, "estatura (80–250 cm)"],
    ["monthlyGoalKm", 1, 10000, "objetivo mensual (1–10.000 km)"],
  ] as const) {
    const value = result[field].replace(",", ".");
    if (
      value &&
      (!/^\d+(\.\d{1,2})?$/.test(value) ||
        Number(value) < min ||
        Number(value) > max)
    )
      throw new Error(`Revisa tu ${label}.`);
    if (field === "monthlyGoalKm" && !value)
      throw new Error("Indica un objetivo mensual.");
    result[field] = value;
  }
  return result;
}
