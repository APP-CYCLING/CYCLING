export type AuthMode = "login" | "register";
export type AuthValues = { name: string; email: string; password: string };
export type AuthFieldErrors = Partial<Record<keyof AuthValues, string>>;
export function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
export function validateAuthForm(
  mode: AuthMode,
  values: AuthValues,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  if (
    mode === "register" &&
    (values.name.trim().length < 2 || values.name.trim().length > 80)
  )
    errors.name = "Escribe tu nombre y apellido (entre 2 y 80 caracteres).";
  if (!validEmail(values.email))
    errors.email = "Introduce un correo electrónico válido.";
  if (!values.password) errors.password = "Introduce tu contraseña.";
  else if (mode === "register" && values.password.length < 8)
    errors.password = "Usa al menos 8 caracteres para tu contraseña.";
  return errors;
}
export function authErrorMessage(error: unknown): string {
  const value =
    error && typeof error === "object"
      ? (error as { code?: string; message?: string; status?: number })
      : {};
  const messages: Record<string, string> = {
    invalid_credentials: "El correo o la contraseña no son correctos.",
    email_not_confirmed:
      "Confirma tu correo electrónico antes de iniciar sesión.",
    user_already_exists:
      "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
    email_exists: "Ya existe una cuenta con ese correo. Prueba iniciar sesión.",
    weak_password:
      "La contraseña no cumple los requisitos. Elige una más segura.",
    signup_disabled: "El registro de cuentas está deshabilitado temporalmente.",
    over_email_send_rate_limit:
      "Espera unos minutos antes de volver a solicitar un correo.",
    over_request_rate_limit:
      "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.",
  };
  if (value.code && messages[value.code]) return messages[value.code];
  if (value.status === 429) return messages.over_request_rate_limit;
  if (/fetch|network|timeout|connection/i.test(value.message ?? ""))
    return "No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.";
  return "No se pudo continuar. Revisa tus datos e inténtalo de nuevo.";
}
