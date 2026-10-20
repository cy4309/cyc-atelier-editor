import { getCloudflareBindings } from "@/lib/server/cloudflare";
import { D1SiteRepository, type D1Like } from "./d1-repository";
import { getFileRepository } from "./file-repository";
import type { SiteRepository } from "./types";

export async function getRepository(): Promise<SiteRepository> {
  const bindings = await getCloudflareBindings();
  if (bindings) {
    if (!bindings.DB) {
      throw new Error("Cloudflare 環境沒有 D1 binding「DB」。請先建立資料庫並寫入 wrangler.jsonc。");
    }
    return new D1SiteRepository(bindings.DB as D1Like);
  }
  return getFileRepository();
}
