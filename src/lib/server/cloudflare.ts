export type AiBinding = {
  run: (model: string, input: Record<string, unknown>) => Promise<unknown>;
};

export type CloudflareBindings = {
  DB?: unknown;
  AI?: AiBinding;
  ADMIN_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  WORKERS_AI_MODEL?: string;
};

export async function getCloudflareBindings(): Promise<CloudflareBindings | null> {
  const existing = readContextFromGlobal();
  if (existing) return existing;
  // 在 next dev 主動呼叫 getCloudflareContext() 會啟動 Wrangler，並把 AI binding 轉到遠端。
  // 只有部署後的 Worker（已放入 context）或明確開啟本機 binding 時才讀 Cloudflare。
  if (process.env.CLOUDFLARE_USE_BINDINGS !== "1") return null;

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const context = await getCloudflareContext({ async: true });
    return normalizeEnv(context.env as CloudflareBindings);
  } catch {
    return null;
  }
}

function readContextFromGlobal(): CloudflareBindings | null {
  const holder = globalThis as Record<symbol, { env?: CloudflareBindings } | undefined>;
  return normalizeEnv(holder[Symbol.for("__cloudflare-context__")]?.env);
}

function normalizeEnv(env: CloudflareBindings | undefined): CloudflareBindings | null {
  if (!env) return null;
  if (!env.DB && !env.AI && !env.ADMIN_TOKEN) return null;
  return env;
}

export async function readRuntimeEnv(): Promise<{
  adminToken: string;
  accountId: string;
  apiToken: string;
  model: string;
  ai: AiBinding | null;
  onCloudflare: boolean;
}> {
  const bindings = await getCloudflareBindings();
  return {
    adminToken: bindings?.ADMIN_TOKEN || process.env.ADMIN_TOKEN || "",
    accountId: bindings?.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID || "",
    apiToken: bindings?.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN || "",
    model:
      bindings?.WORKERS_AI_MODEL ||
      process.env.WORKERS_AI_MODEL ||
      "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    ai: bindings?.AI ?? null,
    onCloudflare: Boolean(bindings),
  };
}
