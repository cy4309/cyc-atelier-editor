import { proposeFromPrompt } from "@/lib/server/ai";
import { describeChange } from "@/lib/content/patch";
import { getRepository } from "@/lib/repository";
import { requireAdmin } from "@/lib/server/editor";
import { jsonError, jsonOk, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const prompt =
    body.value && typeof body.value === "object" && "prompt" in body.value ? String(body.value.prompt ?? "") : "";
  try {
    const state = await (await getRepository()).getState();
    const result = await proposeFromPrompt(prompt, state.draft);
    if (!result.ok) return jsonError(result.error, result.status, result.code);
    if (result.proposal.unsupportedReason) {
      return jsonError(`目前不支援這類修改：${result.proposal.unsupportedReason}`, 422, "UNSUPPORTED");
    }
    return jsonOk({
      summary: result.proposal.summary,
      changes: result.proposal.changes,
      descriptions: result.proposal.changes.map(describeChange),
    });
  } catch (error) {
    console.error("ai_route_error", error instanceof Error ? error.message : "unknown");
    return jsonError("AI 呼叫失敗，草稿沒有被修改。", 502, "AI_ERROR");
  }
}
