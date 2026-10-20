import { z } from "zod";

export const BACKGROUND_OPTIONS = ["paper", "ink", "mist", "clay"] as const;
export const TEXT_OPTIONS = ["ink", "paper", "stone"] as const;
export const ACCENT_OPTIONS = ["copper", "moss", "wine", "gold"] as const;
export const FONT_OPTIONS = ["editorial", "modern", "mixed"] as const;
export const RADIUS_OPTIONS = ["sharp", "soft", "pill"] as const;
export const DENSITY_OPTIONS = ["compact", "regular", "airy"] as const;

export const BUNDLED_IMAGES = [
  "/images/cafe-day.svg",
  "/images/cafe-night.svg",
  "/images/atelier.svg",
] as const;

const unsafeText = /[<>]|javascript\s*:|data\s*:|vbscript\s*:|on\w+\s*=/i;

function plainText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !unsafeText.test(value), "文字不可包含 HTML、腳本或危險協定");
}

export function isSafeHref(value: string): boolean {
  if (value.startsWith("#")) return /^#[A-Za-z][\w-]*$/.test(value);
  if (value.startsWith("/")) {
    return (
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\") &&
      !value.includes("..") &&
      !/[\s<>]/.test(value)
    );
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export const hrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(isSafeHref, "連結只允許 https、站內 / 路徑或 # 錨點");

export const imageUrlSchema = z
  .string()
  .trim()
  .min(1)
  .max(300)
  .refine(isSafeHref, "圖片只允許 https 或站內 / 路徑");

export const navItemSchema = z
  .object({
    label: plainText(20),
    href: hrefSchema,
  })
  .strict();

export const SECTION_IDS = ["about", "services", "contact"] as const;

export const serviceItemSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z0-9-]{1,40}$/, "服務 id 只允許小寫英數與連字號"),
    title: plainText(40),
    description: plainText(180),
  })
  .strict();

export const layoutSchema = z
  .object({
    order: z
      .array(z.enum(SECTION_IDS))
      .length(3)
      .refine((order) => new Set(order).size === 3, "區塊順序必須包含品牌介紹、服務與聯絡，且不可重複"),
  })
  .strict();

export const themeSchema = z
  .object({
    background: z.enum(BACKGROUND_OPTIONS),
    text: z.enum(TEXT_OPTIONS),
    accent: z.enum(ACCENT_OPTIONS),
    font: z.enum(FONT_OPTIONS),
    radius: z.enum(RADIUS_OPTIONS),
    density: z.enum(DENSITY_OPTIONS),
  })
  .strict();

export const siteContentSchema = z
  .object({
    brand: z
      .object({
        name: plainText(40),
        nav: z.array(navItemSchema).min(1).max(6),
      })
      .strict(),
    hero: z
      .object({
        eyebrow: plainText(40),
        title: plainText(80),
        description: plainText(400),
        buttonLabel: plainText(24),
        buttonHref: hrefSchema,
        imageUrl: imageUrlSchema,
        imageAlt: plainText(80),
      })
      .strict(),
    about: z
      .object({
        title: plainText(40),
        body: plainText(1200),
        imageUrl: imageUrlSchema,
        imageAlt: plainText(80),
      })
      .strict(),
    services: z
      .object({
        title: plainText(40),
        items: z.array(serviceItemSchema).min(1).max(8),
      })
      .strict(),
    contact: z
      .object({
        title: plainText(40),
        description: plainText(400),
        buttonLabel: plainText(24),
        buttonHref: hrefSchema,
      })
      .strict(),
    footer: z
      .object({
        text: plainText(120),
      })
      .strict(),
    layout: layoutSchema,
    theme: themeSchema,
  })
  .strict();

export type SiteContent = z.infer<typeof siteContentSchema>;
export type SiteTheme = z.infer<typeof themeSchema>;
export type ServiceItem = z.infer<typeof serviceItemSchema>;

export const replaceChangeSchema = z
  .object({
    op: z.literal("replace"),
    path: z.string().trim().min(1).max(80),
    value: z.unknown(),
  })
  .strict();

export const moveChangeSchema = z
  .object({
    op: z.literal("move"),
    path: z.literal("services.items"),
    from: z.number().int().nonnegative(),
    to: z.number().int().nonnegative(),
  })
  .strict();

export const removeChangeSchema = z
  .object({
    op: z.literal("remove"),
    path: z.literal("services.items"),
    index: z.number().int().nonnegative(),
  })
  .strict();

export const insertChangeSchema = z
  .object({
    op: z.literal("insert"),
    path: z.literal("services.items"),
    index: z.number().int().nonnegative(),
    value: z.unknown(),
  })
  .strict();

export const changeSchema = z.discriminatedUnion("op", [
  replaceChangeSchema,
  moveChangeSchema,
  removeChangeSchema,
  insertChangeSchema,
]);

export const proposalSchema = z
  .object({
    summary: z.string().trim().min(1).max(300),
    unsupportedReason: z.string().trim().min(1).max(300).nullable().optional(),
    changes: z.array(changeSchema).max(20),
  })
  .strict();

export type ContentChange = z.infer<typeof changeSchema>;
export type ContentProposal = z.infer<typeof proposalSchema>;

export const PROMPT_MAX_LENGTH = 2000;
export const REQUEST_BODY_MAX_CHARS = 100_000;
