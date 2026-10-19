const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process");
function readEnv(file = "apps/mobile/.env") {
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Z_][A-Z_0-9]*)\s*=\s*(.*?)\s*$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, "$2")]),
  );
}
function managementToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN)
    return process.env.SUPABASE_ACCESS_TOKEN;
  const legacy = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".supabase",
    "access-token",
  );
  if (fs.existsSync(legacy)) {
    const token = fs.readFileSync(legacy, "utf8").trim();
    if (token.startsWith("sbp_")) return token;
  }
  if (process.platform !== "win32")
    throw new Error(
      "Define SUPABASE_ACCESS_TOKEN en tu terminal para esta operación. No lo pegues en el chat.",
    );
  // Read only the existing CLI login. Child stdout is captured, never logged.
  const source = `
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;
public class CyclingCliCredential {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct Credential { public UInt32 Flags,Type; public string TargetName,Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist,AttributeCount; public IntPtr Attributes; public string TargetAlias,UserName; }
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool Read(string target,UInt32 type,UInt32 flags,out IntPtr pointer);
 [DllImport("advapi32.dll")] static extern void CredFree(IntPtr pointer);
 public static string Get() { IntPtr pointer; if(!Read("Supabase CLI:supabase",1,0,out pointer))return ""; try {var c=(Credential)Marshal.PtrToStructure(pointer,typeof(Credential)); var bytes=new byte[c.CredentialBlobSize];Marshal.Copy(c.CredentialBlob,bytes,0,bytes.Length);return Convert.ToBase64String(bytes);} finally {CredFree(pointer);} }
}
'@
[Console]::Write([CyclingCliCredential]::Get())`;
  let blob;
  try {
    blob = Buffer.from(
      cp
        .execFileSync(
          "powershell.exe",
          ["-NoProfile", "-NonInteractive", "-Command", source],
          {
            encoding: "utf8",
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
          },
        )
        .trim(),
      "base64",
    );
  } catch {
    throw new Error("No se pudo leer la sesión existente de Supabase CLI.");
  }
  for (let token of [blob.toString("utf8"), blob.toString("utf16le")]) {
    token = token.trim();
    if (token.startsWith("go-keyring-base64:"))
      token = Buffer.from(token.slice(18), "base64").toString("utf8");
    if (/^sbp_[a-zA-Z0-9_-]{20,}$/.test(token)) return token;
  }
  throw new Error("Inicia sesión con Supabase CLI antes de configurar Google.");
}
async function management(pathname, { method = "GET", body } = {}) {
  const response = await fetch(`https://api.supabase.com/v1/${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${managementToken()}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok)
    throw new Error(
      `Supabase Management HTTP ${response.status}; no se mostraron credenciales.`,
    );
  return response.json();
}
module.exports = { readEnv, management };
