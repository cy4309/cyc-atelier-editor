import { cookies } from "next/headers";
import { readRuntimeEnv } from "./cloudflare";

const COOKIE_NAME = "cyc_admin";
const SESSION_MESSAGE = "cyc-admin-v1";

export async function adminAccess(): Promise<
  | { ok: true; devBypass: boolean }
  | { ok: false; status: number; error: string; code: string }
> {
  const env = await readRuntimeEnv();
  const development = process.env.NODE_ENV !== "production";
  if (!env.adminToken) {
    if (development) return { ok: true, devBypass: true };
    return {
      ok: false,
      status: 503,
      error: "正式環境尚未設定 ADMIN_TOKEN，管理寫入已關閉。",
      code: "ADMIN_NOT_CONFIGURED",
    };
  }
  const jar = await cookies();
  const provided = jar.get(COOKIE_NAME)?.value ?? "";
  const expected = await signSession(env.adminToken);
  if (provided && (await sameSecret(provided, expected))) return { ok: true, devBypass: false };
  return { ok: false, status: 401, error: "需要管理權杖才能操作。", code: "UNAUTHORIZED" };
}

export async function loginWithToken(token: string): Promise<{ ok: true; cookie: string } | { ok: false; error: string }> {
  const env = await readRuntimeEnv();
  if (!env.adminToken) return { ok: false, error: "伺服器尚未設定 ADMIN_TOKEN。" };
  if (!(await sameSecret(token.trim(), env.adminToken))) return { ok: false, error: "管理權杖不正確。" };
  return { ok: true, cookie: await signSession(env.adminToken) };
}

export function adminCookieName(): string {
  return COOKIE_NAME;
}

async function signSession(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(SESSION_MESSAGE));
  return toHex(signature);
}

export async function sameSecret(left: string, right: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const leftBytes = new Uint8Array(a);
  const rightBytes = new Uint8Array(b);
  let mismatch = 0;
  for (let index = 0; index < leftBytes.length; index += 1) {
    mismatch |= leftBytes[index] ^ rightBytes[index];
  }
  return mismatch === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
