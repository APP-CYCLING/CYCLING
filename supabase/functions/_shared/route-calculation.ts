import { ApiError, coordinate, record, type normalizeRoute } from "./domain.ts";

export function cachedCalculation(
  value: unknown,
  userId: string,
  origin: ReturnType<typeof coordinate>,
  destination: ReturnType<typeof coordinate>,
) {
  const job = record(value),
    from = coordinate(job.origin),
    to = coordinate(job.destination);
  if (
    job.version !== 1 ||
    job.userId !== userId ||
    from.latitude !== origin.latitude ||
    from.longitude !== origin.longitude ||
    to.latitude !== destination.latitude ||
    to.longitude !== destination.longitude
  )
    throw new ApiError(
      409,
      "El cálculo corresponde a otra búsqueda. Vuelve a calcular la ruta.",
    );
  return job.route as ReturnType<typeof normalizeRoute>;
}
