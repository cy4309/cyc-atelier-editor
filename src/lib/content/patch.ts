import { z } from "zod";
import {
  type ContentChange,
  type ContentProposal,
  type ServiceItem,
  type SiteContent,
  hrefSchema,
  imageUrlSchema,
  layoutSchema,
  navItemSchema,
  proposalSchema,
  serviceItemSchema,
  siteContentSchema,
  themeSchema,
} from "./schema";

const scalarRules: Record<string, z.ZodType> = {
  "brand.name": siteContentSchema.shape.brand.shape.name,
  "hero.eyebrow": siteContentSchema.shape.hero.shape.eyebrow,
  "hero.title": siteContentSchema.shape.hero.shape.title,
  "hero.description": siteContentSchema.shape.hero.shape.description,
  "hero.buttonLabel": siteContentSchema.shape.hero.shape.buttonLabel,
  "hero.buttonHref": hrefSchema,
  "hero.imageUrl": imageUrlSchema,
  "hero.imageAlt": siteContentSchema.shape.hero.shape.imageAlt,
  "about.title": siteContentSchema.shape.about.shape.title,
  "about.body": siteContentSchema.shape.about.shape.body,
  "about.imageUrl": imageUrlSchema,
  "about.imageAlt": siteContentSchema.shape.about.shape.imageAlt,
  "services.title": siteContentSchema.shape.services.shape.title,
  "contact.title": siteContentSchema.shape.contact.shape.title,
  "contact.description": siteContentSchema.shape.contact.shape.description,
  "contact.buttonLabel": siteContentSchema.shape.contact.shape.buttonLabel,
  "contact.buttonHref": hrefSchema,
  "footer.text": siteContentSchema.shape.footer.shape.text,
  "layout.order": layoutSchema.shape.order,
  "theme.background": themeSchema.shape.background,
  "theme.text": themeSchema.shape.text,
  "theme.accent": themeSchema.shape.accent,
  "theme.font": themeSchema.shape.font,
  "theme.radius": themeSchema.shape.radius,
  "theme.density": themeSchema.shape.density,
};

const serviceFieldPattern = /^services\.items\.(\d+)\.(title|description)$/;
const navFieldPattern = /^brand\.nav\.(\d+)\.(label|href)$/;

export type PatchResult =
  | { ok: true; content: SiteContent }
  | { ok: false; error: string };

export function validateProposal(input: unknown): { ok: true; proposal: ContentProposal } | { ok: false; error: string } {
  const parsed = proposalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: formatZodError(parsed.error) };
  }
  const proposal = parsed.data;
  const hasReason = Boolean(proposal.unsupportedReason);
  if (hasReason && proposal.changes.length > 0) {
    return { ok: false, error: "不支援的需求不能同時附帶修改" };
  }
  if (!hasReason && proposal.changes.length === 0) {
    return { ok: false, error: "模型沒有產生任何修改" };
  }
  if (hasReason) return { ok: true, proposal };

  const semantic = explainChanges(proposal.changes);
  if (!semantic.ok) return semantic;
  return { ok: true, proposal };
}

export function applyPatch(content: SiteContent, changes: ContentChange[]): PatchResult {
  const explained = explainChanges(changes);
  if (!explained.ok) return explained;
  const next = structuredClone(content) as SiteContent;
  for (const change of changes) {
    const applied = applyOne(next, change);
    if (!applied.ok) return applied;
  }
  const parsed = siteContentSchema.safeParse(next);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  return { ok: true, content: parsed.data };
}

function explainChanges(changes: ContentChange[]): { ok: true } | { ok: false; error: string } {
  const seen = new Set<string>();
  let touchesServices = false;
  for (const change of changes) {
    const key = changeKey(change);
    if (seen.has(key)) return { ok: false, error: `重複的修改：${key}` };
    seen.add(key);
    if (change.op !== "replace" || change.path === "services.items" || change.path.startsWith("services.items.")) {
      if (change.path === "services.items" || change.path.startsWith("services.items")) touchesServices = true;
    }
    if (change.op !== "replace") touchesServices = true;
    const check = checkChangeShape(change);
    if (!check.ok) return check;
  }
  if (touchesServices) {
    const structural = changes.filter((change) => change.op !== "replace" || change.path === "services.items");
    const fieldEdits = changes.filter(
      (change) => change.op === "replace" && change.path.startsWith("services.items."),
    );
    if (structural.length > 0 && fieldEdits.length > 0) {
      return { ok: false, error: "服務卡片的整批調整與單欄修改互相衝突" };
    }
    if (structural.length > 1) {
      return { ok: false, error: "同一批修改只能有一項服務排序、新增、刪除或整表替換" };
    }
  }
  return { ok: true };
}

function changeKey(change: ContentChange): string {
  if (change.op === "replace") return change.path;
  if (change.op === "move") return `move:${change.from}->${change.to}`;
  if (change.op === "remove") return `remove:${change.index}`;
  return `insert:${change.index}`;
}

function checkChangeShape(change: ContentChange): { ok: true } | { ok: false; error: string } {
  if (change.op === "replace") {
    const rule = ruleForPath(change.path);
    if (!rule) return { ok: false, error: `不允許修改欄位：${change.path}` };
    const parsed = rule.safeParse(change.value);
    if (!parsed.success) return { ok: false, error: `${change.path}：${formatZodError(parsed.error)}` };
    return { ok: true };
  }
  if (change.op === "insert") {
  const parsed = normalizeServiceInsert(change.value, change.index);
  if (!parsed.ok) return { ok: false, error: `新增服務：${parsed.error}` };
  }
  return { ok: true };
}

function ruleForPath(path: string): z.ZodType | null {
  if (scalarRules[path]) return scalarRules[path];
  if (path === "services.items") return siteContentSchema.shape.services.shape.items;
  if (path === "brand.nav") return siteContentSchema.shape.brand.shape.nav;
  const serviceMatch = serviceFieldPattern.exec(path);
  if (serviceMatch) {
    return serviceMatch[2] === "title" ? serviceItemSchema.shape.title : serviceItemSchema.shape.description;
  }
  const navMatch = navFieldPattern.exec(path);
  if (navMatch) return navMatch[2] === "label" ? navItemSchema.shape.label : hrefSchema;
  return null;
}

function applyOne(content: SiteContent, change: ContentChange): PatchResult {
  if (change.op === "replace") {
    const rule = ruleForPath(change.path);
    if (!rule) return { ok: false, error: `不允許修改欄位：${change.path}` };
    const parsed = rule.safeParse(change.value);
    if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
    if (!setPath(content, change.path, parsed.data)) {
      return { ok: false, error: `找不到欄位：${change.path}` };
    }
    return { ok: true, content };
  }
  if (change.op === "move") {
    const items = content.services.items;
    if (change.from >= items.length || change.to >= items.length) {
      return { ok: false, error: "服務卡片索引超出範圍" };
    }
    const [item] = items.splice(change.from, 1);
    items.splice(change.to, 0, item);
    return { ok: true, content };
  }
  if (change.op === "remove") {
    if (content.services.items.length <= 1) return { ok: false, error: "至少要保留一張服務卡片" };
    if (change.index >= content.services.items.length) return { ok: false, error: "服務卡片索引超出範圍" };
    content.services.items.splice(change.index, 1);
    return { ok: true, content };
  }
  const parsed = normalizeServiceInsert(change.value, change.index);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (content.services.items.length >= 8) return { ok: false, error: "服務卡片最多 8 張" };
  if (change.index > content.services.items.length) return { ok: false, error: "服務卡片索引超出範圍" };
  const item = parsed.item;
  if (content.services.items.some((existing) => existing.id === item.id)) {
    item.id = `svc-new-${change.index}b`;
  }
  content.services.items.splice(change.index, 0, item);
  return { ok: true, content };
}

function setPath(content: SiteContent, path: string, value: unknown): boolean {
  if (path === "services.items") {
    content.services.items = value as ServiceItem[];
    return true;
  }
  if (path === "brand.nav") {
    content.brand.nav = value as SiteContent["brand"]["nav"];
    return true;
  }
  const serviceMatch = serviceFieldPattern.exec(path);
  if (serviceMatch) {
    const index = Number(serviceMatch[1]);
    const item = content.services.items[index];
    if (!item) return false;
    if (serviceMatch[2] === "title") item.title = value as string;
    else item.description = value as string;
    return true;
  }
  const navMatch = navFieldPattern.exec(path);
  if (navMatch) {
    const index = Number(navMatch[1]);
    const item = content.brand.nav[index];
    if (!item) return false;
    if (navMatch[2] === "label") item.label = value as string;
    else item.href = value as string;
    return true;
  }
  const segments = path.split(".");
  let cursor: Record<string, unknown> = content as unknown as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const next = cursor[segments[i]];
    if (!next || typeof next !== "object") return false;
    cursor = next as Record<string, unknown>;
  }
  const leaf = segments[segments.length - 1];
  if (!(leaf in cursor)) return false;
  cursor[leaf] = value;
  return true;
}

export const insertServiceSchema = z
  .object({
    id: z.string().trim().min(1).max(40).optional(),
    title: serviceItemSchema.shape.title,
    description: serviceItemSchema.shape.description,
  })
  .strict();

function normalizeServiceInsert(
  value: unknown,
  index: number,
): { ok: true; item: ServiceItem } | { ok: false; error: string } {
  const parsed = insertServiceSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  const id = parsed.data.id && /^[a-z0-9-]{1,40}$/.test(parsed.data.id)
    ? parsed.data.id
    : `svc-new-${index}`;
  const item = serviceItemSchema.safeParse({ ...parsed.data, id });
  if (!item.success) return { ok: false, error: formatZodError(item.error) };
  return { ok: true, item: item.data };
}

export function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "內容";
      return `${path}：${issue.message}`;
    })
    .join("；");
}

const pathLabels: Record<string, string> = {
  "brand.name": "品牌名稱",
  "hero.eyebrow": "首頁眉標",
  "hero.title": "首頁標題",
  "hero.description": "首頁描述",
  "hero.buttonLabel": "首頁按鈕文字",
  "hero.buttonHref": "首頁按鈕連結",
  "hero.imageUrl": "主視覺圖片",
  "hero.imageAlt": "主視覺替代文字",
  "about.title": "品牌介紹標題",
  "about.body": "品牌介紹內文",
  "about.imageUrl": "品牌介紹圖片",
  "about.imageAlt": "品牌介紹圖片替代文字",
  "services.title": "服務區塊標題",
  "services.items": "服務卡片",
  "brand.nav": "導覽",
  "contact.title": "聯絡標題",
  "contact.description": "聯絡描述",
  "contact.buttonLabel": "聯絡按鈕文字",
  "contact.buttonHref": "聯絡按鈕連結",
  "footer.text": "頁尾文字",
  "layout.order": "區塊順序",
  "theme.background": "背景風格",
  "theme.text": "文字顏色",
  "theme.accent": "強調色",
  "theme.font": "字體風格",
  "theme.radius": "圓角風格",
  "theme.density": "版面密度",
};

export function describeChange(change: ContentChange): string {
  if (change.op === "move") return `調整服務卡片順序：第 ${change.from + 1} 項移到第 ${change.to + 1} 項`;
  if (change.op === "remove") return `移除第 ${change.index + 1} 張服務卡片`;
  if (change.op === "insert") {
    const title =
      change.value && typeof change.value === "object" && "title" in change.value
        ? String((change.value as { title?: unknown }).title ?? "")
        : "";
    return `新增服務卡片${title ? `「${title}」` : ""}`;
  }
  const serviceMatch = serviceFieldPattern.exec(change.path);
  if (serviceMatch) {
    const label = serviceMatch[2] === "title" ? "標題" : "說明";
    return `服務卡片 ${Number(serviceMatch[1]) + 1} 的${label}改為「${String(change.value)}」`;
  }
  const navMatch = navFieldPattern.exec(change.path);
  if (navMatch) {
    const label = navMatch[2] === "label" ? "文字" : "連結";
    return `導覽第 ${Number(navMatch[1]) + 1} 項${label}改為「${String(change.value)}」`;
  }
  const label = pathLabels[change.path] ?? change.path;
  if (change.path === "layout.order" && Array.isArray(change.value)) {
    const names: Record<string, string> = { about: "品牌介紹", services: "服務", contact: "聯絡" };
    return `區塊順序改為 ${change.value.map((item) => names[String(item)] ?? String(item)).join(" → ")}`;
  }
  if (change.path === "services.items" || change.path === "brand.nav") return `更新${label}`;
  return `${label}改為「${String(change.value)}」`;
}
