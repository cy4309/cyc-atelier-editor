import { connection } from "next/server";
import { getRepository } from "@/lib/repository";
import { jsonOk } from "@/lib/server/http";

export async function GET() {
  await connection();
  const state = await (await getRepository()).getState();
  return jsonOk({ content: state.published, updatedAt: state.updatedAt });
}
