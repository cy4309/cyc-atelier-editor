import { NextResponse } from "next/server";
import { REQUEST_BODY_MAX_CHARS } from "@/lib/content/schema";

export function jsonError(error: string, status: number, code: string) {
  return NextResponse.json({ ok: false, error, code }, { status });
}

export function jsonOk(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ok: true, ...body }, { status });
}

export async function readJson(request: Request): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > REQUEST_BODY_MAX_CHARS) {
    return { ok: false, response: jsonError("請求內容過大。", 413, "VALIDATION") };
  }
  const text = await request.text();
  if (text.length > REQUEST_BODY_MAX_CHARS) {
    return { ok: false, response: jsonError("請求內容過大。", 413, "VALIDATION") };
  }
  if (!text) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, response: jsonError("請求不是合法的 JSON。", 400, "VALIDATION") };
  }
}
