import { BUNDLED_IMAGES, PROMPT_MAX_LENGTH, type ContentProposal, type SiteContent } from "@/lib/content/schema";
import { validateProposal } from "@/lib/content/patch";
import { readRuntimeEnv, type AiBinding } from "./cloudflare";

const AI_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    unsupportedReason: { type: ["string", "null"] },
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          op: { type: "string", enum: ["replace", "move", "insert", "remove"] },
          path: { type: "string" },
          value: {},
          from: { type: "integer" },
          to: { type: "integer" },
          index: { type: "integer" },
        },
        required: ["op", "path"],
      },
    },
  },
  required: ["summary", "changes"],
};

const SYSTEM_PROMPT = `你是 CYC Atelier 網站的內容編輯助手。你只能輸出一個 JSON 物件，不要輸出 Markdown。
你不能提供 HTML、CSS、JavaScript、SQL 或任何程式碼。你不能要求修改環境變數、資料庫結構、權限或後端程式。
若使用者的要求超出可編輯欄位，把 unsupportedReason 設成繁體中文原因，changes 設成空陣列，不要改其他欄位。
可修改欄位：brand.name、brand.nav、brand.nav.N.label、brand.nav.N.href、hero.eyebrow、hero.title、hero.description、hero.buttonLabel、hero.buttonHref、hero.imageUrl、hero.imageAlt、about.title、about.body、about.imageUrl、about.imageAlt、services.title、services.items、services.items.N.title、services.items.N.description、contact.title、contact.description、contact.buttonLabel、contact.buttonHref、footer.text、layout.order、theme.background、theme.text、theme.accent、theme.font、theme.radius、theme.density。
theme 只能使用這些值：background=paper|ink|mist|clay，text=ink|paper|stone，accent=copper|moss|wine|gold，font=editorial|modern|mixed，radius=sharp|soft|pill，density=compact|regular|airy。
layout.order 必須是 ["about","services","contact"] 的一種排列。把服務區塊移到品牌介紹前面時，回傳 ["services","about","contact"]。
服務卡片排序使用 {"op":"move","path":"services.items","from":0,"to":1}。
圖片若使用者沒有提供 https URL，只能改成這些站內圖：${BUNDLED_IMAGES.join("、")}。自然光咖啡店用 /images/cafe-day.svg，深色極簡用 /images/cafe-night.svg，工作室用 /images/atelier.svg。不要發明外部圖片網址。
連結只允許 https、以 / 開頭的站內路徑，或 # 錨點。
深色極簡高級感請把 theme.background 設為 ink、theme.text 設為 paper、theme.font 設為 modern、theme.radius 設為 sharp、theme.density 設為 airy，並可把主視覺換成 /images/cafe-night.svg。`;

export type AiEditSuccess = {
  ok: true;
  proposal: ContentProposal;
};

export type AiEditFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export async function proposeFromPrompt(prompt: string, content: SiteContent): Promise<AiEditSuccess | AiEditFailure> {
  const cleaned = prompt.trim();
  if (!cleaned) return { ok: false, status: 400, code: "VALIDATION", error: "請輸入想修改的內容。" };
  if (cleaned.length > PROMPT_MAX_LENGTH) {
    return { ok: false, status: 400, code: "VALIDATION", error: `Prompt 最長 ${PROMPT_MAX_LENGTH} 個字元。` };
  }

  const env = await readRuntimeEnv();
  const provider = resolveProvider(env);
  if (!provider) {
    return {
      ok: false,
      status: 503,
      code: "AI_NOT_CONFIGURED",
      error:
        "尚未設定 AI。請在 Cloudflare 綁定 Workers AI（binding 名稱 AI），或在伺服器環境變數設定 CLOUDFLARE_ACCOUNT_ID 與 CLOUDFLARE_API_TOKEN。此畫面不會用關鍵字規則假裝完成修改。",
    };
  }

  let lastError = "AI 沒有回傳可使用的內容。";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const raw = await provider.run(cleaned, content, attempt === 2 ? lastError : undefined);
      const extracted = extractJson(raw);
      if (!extracted.ok) {
        lastError = extracted.error;
        continue;
      }
      const validated = validateProposal(sanitizeProposal(extracted.value));
      if (!validated.ok) {
        lastError = validated.error;
        continue;
      }
      return { ok: true, proposal: validated.proposal };
    } catch (error) {
      lastError = toAiErrorMessage(error);
      if (isQuotaOrAuth(lastError)) break;
    }
  }

  return { ok: false, status: 502, code: "AI_ERROR", error: lastError };
}

type Provider = {
  run: (prompt: string, content: SiteContent, previousError?: string) => Promise<unknown>;
};

function resolveProvider(env: Awaited<ReturnType<typeof readRuntimeEnv>>): Provider | null {
  if (env.ai) return { run: (prompt, content, previousError) => runBinding(env.ai as AiBinding, env.model, prompt, content, previousError) };
  if (env.accountId && env.apiToken) {
    return {
      run: (prompt, content, previousError) =>
        runRest(env.accountId, env.apiToken, env.model, prompt, content, previousError),
    };
  }
  return null;
}

async function runBinding(
  ai: AiBinding,
  model: string,
  prompt: string,
  content: SiteContent,
  previousError?: string,
): Promise<unknown> {
  return withTimeout(
    ai.run(model, requestBody(prompt, content, previousError)),
    25000,
  );
}

async function runRest(
  accountId: string,
  apiToken: string,
  model: string,
  prompt: string,
  content: SiteContent,
  previousError?: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody(prompt, content, previousError)),
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; errors?: { message?: string }[]; result?: unknown }
      | null;
    if (!response.ok || payload?.success === false) {
      const message = payload?.errors?.map((item) => item.message).filter(Boolean).join("；");
      throw new Error(message || `Workers AI 回應 ${response.status}`);
    }
    return payload?.result ?? payload;
  } finally {
    clearTimeout(timer);
  }
}

function requestBody(prompt: string, content: SiteContent, previousError?: string) {
  const reminder = previousError
    ? `\n上一則輸出無法使用：${previousError}。請只回傳符合 schema 的 JSON。`
    : "";
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `目前網站內容：\n${JSON.stringify(content)}\n\n業主要求：${prompt}${reminder}`,
      },
    ],
    max_tokens: 1200,
    response_format: {
      type: "json_schema",
      json_schema: AI_SCHEMA,
    },
  };
}

async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("AI 請求逾時")), ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function extractJson(payload: unknown): { ok: true; value: unknown } | { ok: false; error: string } {
  const candidate = unwrap(payload);
  if (candidate && typeof candidate === "object") return { ok: true, value: candidate };
  if (typeof candidate !== "string") return { ok: false, error: "AI 回傳的不是 JSON。" };
  const trimmed = candidate.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, error: "AI 回傳的 JSON 無法解析。" };
  }
}

function unwrap(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if ("response" in record) return record.response;
  if (record.result && typeof record.result === "object" && "response" in (record.result as Record<string, unknown>)) {
    return (record.result as Record<string, unknown>).response;
  }
  const choices = record.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const message = (choices[0] as { message?: { content?: unknown } }).message;
    if (message && "content" in message) return message.content;
  }
  return payload;
}

export function sanitizeProposal(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const record = input as Record<string, unknown>;
  const changes = Array.isArray(record.changes) ? record.changes.map(sanitizeChange) : record.changes;
  return {
    summary: record.summary,
    unsupportedReason: record.unsupportedReason ?? undefined,
    changes,
  };
}

function sanitizeChange(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;
  const change = input as Record<string, unknown>;
  if (change.op === "replace") return { op: "replace", path: change.path, value: change.value };
  if (change.op === "move") return { op: "move", path: change.path, from: change.from, to: change.to };
  if (change.op === "remove") return { op: "remove", path: change.path, index: change.index };
  if (change.op === "insert") return { op: "insert", path: change.path, index: change.index, value: change.value };
  return { op: change.op, path: change.path };
}

function toAiErrorMessage(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") return "AI 請求逾時，草稿沒有被修改。";
  const message = error instanceof Error ? error.message : "AI 呼叫失敗";
  if (/json mode couldn't be met/i.test(message)) return "模型無法產生符合格式的 JSON，草稿沒有被修改。";
  if (/quota|neuron|billing|insufficient|429/i.test(message)) return "AI 額度不足或已超過限制，草稿沒有被修改。";
  if (/auth|401|403|permission/i.test(message)) return "AI 服務拒絕存取。請檢查 Cloudflare token 或 Workers AI binding。";
  return `AI 呼叫失敗：${message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]")}`;
}

function isQuotaOrAuth(message: string): boolean {
  return message.includes("額度") || message.includes("拒絕存取") || message.includes("逾時");
}

export async function aiConfigured(): Promise<boolean> {
  const env = await readRuntimeEnv();
  return Boolean(env.ai || (env.accountId && env.apiToken));
}
