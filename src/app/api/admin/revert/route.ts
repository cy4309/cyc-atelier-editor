import { getRepository } from "@/lib/repository";
import { presentState, requireAdmin, storageError } from "@/lib/server/editor";
import { jsonOk } from "@/lib/server/http";

export async function POST() {
  const admin = await requireAdmin();
  if (admin.response) return admin.response;
  try {
    const state = await (await getRepository()).revertLatest();
    return jsonOk(await presentState(state));
  } catch (error) {
    return storageError(error);
  }
}
