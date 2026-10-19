import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import { rememberedEmailService } from "../services/remembered-email.service";
import {
  authErrorMessage,
  validateAuthForm,
  type AuthFieldErrors,
  type AuthMode,
} from "../utils/auth-form";
export function useAuthForm() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login"),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true),
    [busy, setBusy] = useState(false),
    [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({}),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [storageNotice, setStorageNotice] = useState("");
  const mounted = useRef(true),
    inFlight = useRef(false),
    emailEdited = useRef(false),
    rememberEdited = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let current = true;
    void rememberedEmailService
      .load()
      .then((value) => {
        if (!current) return;
        if (!emailEdited.current) setEmail(value.email);
        if (!rememberEdited.current) setRemember(value.remember);
      })
      .catch(() => {
        if (current)
          setStorageNotice(
            "No pudimos recuperar el correo guardado. Puedes escribirlo de nuevo.",
          );
      });
    return () => {
      current = false;
      mounted.current = false;
    };
  }, []);
  const update = (field: "name" | "email" | "password", value: string) => {
    if (inFlight.current) return;
    if (field === "email") {
      emailEdited.current = true;
      setEmail(value);
    } else if (field === "name") setName(value);
    else setPassword(value);
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
    setError("");
  };
  const switchMode = () => {
    if (inFlight.current) return;
    emailEdited.current = true;
    setMode((value) => (value === "login" ? "register" : "login"));
    setPassword("");
    setFieldErrors({});
    setError("");
    setSuccess("");
  };
  const leave = () => {
    if (inFlight.current) return;
    if (mode === "register") switchMode();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  const toggleRemember = () => {
    if (inFlight.current) return;
    const value = !remember;
    rememberEdited.current = true;
    setRemember(value);
    setStorageNotice("");
    if (!value)
      void rememberedEmailService.save("", false).catch(() => {
        if (mounted.current)
          setStorageNotice(
            "No se pudo borrar el correo recordado. Inténtalo de nuevo.",
          );
      });
  };
  const submit = async () => {
    if (inFlight.current) return;
    const errors = validateAuthForm(mode, { name, email, password });
    setFieldErrors(errors);
    setError("");
    setSuccess("");
    if (Object.keys(errors).length) return;
    inFlight.current = true;
    setBusy(true);
    try {
      if (mode === "register") {
        const needsConfirmation = await register({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        if (!mounted.current) return;
        setPassword("");
        if (needsConfirmation) {
          setMode("login");
          setFieldErrors({});
          setSuccess(
            "Revisa tu correo: confirma tu cuenta desde el enlace recibido y luego inicia sesión.",
          );
          return;
        }
      } else {
        await login({ email: email.trim(), password });
        // La preferencia local no puede convertir un acceso correcto en un fallo de autenticación.
        await rememberedEmailService.save(email, remember).catch(() => {});
      }
      if (mounted.current) {
        setPassword("");
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }
    } catch (e: unknown) {
      if (mounted.current) setError(authErrorMessage(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const googleSubmit = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { signInWithGoogle } =
        await import("../services/google-auth.service");
      if ((await signInWithGoogle()) && mounted.current) {
        setPassword("");
        router.replace("/");
      }
    } catch (e) {
      if (mounted.current)
        setError(
          e instanceof Error
            ? /native module|Cannot find/i.test(e.message)
              ? "Instala una nueva APK de CYCLING para acceder con Google."
              : e.message
            : "No se pudo acceder con Google.",
        );
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  return {
    mode,
    name,
    email,
    password,
    remember,
    busy,
    fieldErrors,
    error,
    success,
    storageNotice,
    update,
    switchMode,
    leave,
    toggleRemember,
    submit,
    googleSubmit,
  };
}
