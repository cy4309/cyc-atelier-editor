import { NextResponse } from "next/server";
import { adminCookieName, loginWithToken } from "@/lib/server/auth";
import { jsonError, jsonOk, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const token = body.value && typeof body.value === "object" && "token" in body.value ? String(body.value.token ?? "") : "";
  const result = await loginWithToken(token);
  if (!result.ok) return jsonError(result.error, 401, "UNAUTHORIZED");
  const response = jsonOk({ authenticated: true });
  response.cookies.set({
    name: adminCookieName(),
    value: result.cookie,
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

export async function DELETE() {
  const response = jsonOk({ authenticated: false });
  response.cookies.set({
    name: adminCookieName(),
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export function GET() {
  return new NextResponse(null, { status: 405 });
}
