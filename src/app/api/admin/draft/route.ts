import { z } from "zod";
import { applyPatch, describeChange, formatZodError } from "@/lib/content/patch";
import { changeSchema, siteContentSchema } from "@/lib/content/schema";
import { getRepository } from "@/lib/repository";
import { presentState, requireAdmin, storageError } from "@/lib/server/editor";
import { jsonError, jsonOk, readJson } from "@/lib/server/http";

const applyBody = z
  .object({
    changes: z.array(changeSchema).min(1).max(20),
  })
  .strict();

export async function PUT(request: Request) {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const content = body.value && typeof body.value === "object" && "content" in body.value ? body.value.content : body.value;
  const parsed = siteContentSchema.safeParse(content);
  if (!parsed.success) return jsonError(`欄位驗證失敗，草稿沒有被修改。${formatZodError(parsed.error)}`, 422, "VALIDATION");
  try {
    const state = await (await getRepository()).saveDraft(parsed.data);
    return jsonOk(await presentState(state));
  } catch (error) {
    return storageError(error);
  }
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = applyBody.safeParse(body.value);
  if (!parsed.success) return jsonError("修改格式不正確，草稿沒有被修改。", 422, "VALIDATION");
  try {
    const repository = await getRepository();
    const current = await repository.getState();
    const applied = applyPatch(current.draft, parsed.data.changes);
    if (!applied.ok) return jsonError(applied.error, 422, "VALIDATION");
    const state = await repository.saveDraft(applied.content);
    return jsonOk({
      ...(await presentState(state)),
      summary: parsed.data.changes.map(describeChange),
    });
  } catch (error) {
    return storageError(error);
  }
}
