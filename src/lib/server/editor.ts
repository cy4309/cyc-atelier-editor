import { NextResponse } from "next/server";
import { adminAccess } from "@/lib/server/auth";
import { aiConfigured } from "@/lib/server/ai";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getRepository } from "@/lib/repository";
import type { SiteState } from "@/lib/repository/types";

export async function requireAdmin() {
  const access = await adminAccess();
  if (!access.ok) return { access, response: jsonError(access.error, access.status, access.code) };
  return { access, response: null };
}

export async function loadEditorState() {
  const repository = await getRepository();
  const state = await repository.getState();
  const access = await adminAccess();
  return jsonOk({
    ...(await presentState(state)),
    devBypass: access.ok ? access.devBypass : false,
    aiConfigured: await aiConfigured(),
  });
}

export async function presentState(state: SiteState) {
  return {
    draft: state.draft,
    published: state.published,
    updatedAt: state.updatedAt,
    dirty: JSON.stringify(state.draft) !== JSON.stringify(state.published),
    revisions: state.revisions.map((revision) => ({
      id: revision.id,
      summary: revision.summary,
      createdAt: revision.createdAt,
    })),
  };
}

export function storageError(error: unknown) {
  const message = error instanceof Error ? error.message : "儲存失敗";
  if (message.includes("沒有可復原")) return jsonError(message, 409, "CONFLICT");
  console.error("storage_error", message);
  return jsonError("儲存失敗，內容沒有被變更。", 500, "STORAGE");
}

export function methodNotAllowed() {
  return new NextResponse(null, { status: 405 });
}
