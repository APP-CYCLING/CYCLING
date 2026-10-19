import React, { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Page, Notice, PrimaryButton } from "../../../shared/components/UI";
import { BrandLoader } from "../../../shared/components/BrandLoader";
export default function AuthCallbackScreen() {
  const { code, error: oauthError } = useLocalSearchParams<{
      code?: string;
      error?: string;
    }>(),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const complete = async () => {
      setError("");
      if (!code || oauthError)
        throw new Error(
          "No se recibió un código de acceso válido. Vuelve a iniciar sesión.",
        );
      const { completeGoogleLogin, googleRedirectUri } =
        await import("../services/google-auth.service");
      await completeGoogleLogin(
        `${googleRedirectUri()}?code=${encodeURIComponent(code)}`,
      );
      if (active) router.replace("/");
    };
    void complete().catch((e) => {
      if (active)
        setError(e instanceof Error ? e.message : "No se pudo iniciar sesión.");
    });
    return () => {
      active = false;
    };
  }, [code, oauthError]);
  return (
    <Page>
      {error ? (
        <>
          <Notice message={error} />
          <PrimaryButton
            title="Volver al acceso"
            onPress={() => router.replace("/auth")}
          />
        </>
      ) : (
        <BrandLoader fullScreen message="Completando acceso con Google…" />
      )}
    </Page>
  );
}
