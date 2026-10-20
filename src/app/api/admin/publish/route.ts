import { getRepository } from "@/lib/repository";
import { presentState, requireAdmin, storageError } from "@/lib/server/editor";
import { jsonOk, readJson } from "@/lib/server/http";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const summary =
    body.value && typeof body.value === "object" && "summary" in body.value
      ? String(body.value.summary ?? "")
      : "";
  try {
    const state = await (await getRepository()).publish(summary.slice(0, 300));
    return jsonOk(await presentState(state));
  } catch (error) {
    return storageError(error);
  }
}
