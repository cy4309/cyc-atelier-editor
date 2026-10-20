import { describe, expect, it } from "vitest";
import { defaultContent } from "./default-content";
import { applyPatch, validateProposal } from "./patch";
import { siteContentSchema } from "./schema";

describe("site content rules", () => {
  it("accepts the bundled default content", () => {
    expect(siteContentSchema.parse(defaultContent).brand.name).toBe("CYC Atelier");
  });

  it("rejects unsafe urls, html, unknown fields and arbitrary theme values", () => {
    const cases = [
      { op: "replace" as const, path: "hero.imageUrl", value: "javascript:alert(1)" },
      { op: "replace" as const, path: "hero.buttonHref", value: "data:text/html,hi" },
      { op: "replace" as const, path: "hero.title", value: "<script>alert(1)</script>" },
      { op: "replace" as const, path: "theme.background", value: "background: red" },
      { op: "replace" as const, path: "env.SECRET", value: "nope" },
    ];
    for (const change of cases) {
      const result = applyPatch(defaultContent, [change]);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects duplicate or conflicting operations", () => {
    const duplicate = validateProposal({
      summary: "重複",
      changes: [
        { op: "replace", path: "hero.title", value: "甲" },
        { op: "replace", path: "hero.title", value: "乙" },
      ],
    });
    expect(duplicate.ok).toBe(false);

    const conflict = applyPatch(defaultContent, [
      { op: "move", path: "services.items", from: 0, to: 2 },
      { op: "replace", path: "services.items.0.title", value: "新服務" },
    ]);
    expect(conflict.ok).toBe(false);
  });

  it("applies a title change and a section move without touching unrelated fields", () => {
    const result = applyPatch(defaultContent, [
      { op: "replace", path: "hero.title", value: "讓日常多一點靈感" },
      { op: "replace", path: "layout.order", value: ["services", "about", "contact"] },
      { op: "replace", path: "theme.background", value: "ink" },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.content.hero.title).toBe("讓日常多一點靈感");
    expect(result.content.layout.order[0]).toBe("services");
    expect(result.content.theme.background).toBe("ink");
    expect(result.content.about.body).toBe(defaultContent.about.body);
  });

  it("returns an unsupported proposal without changes", () => {
    const result = validateProposal({
      summary: "無法修改程式",
      unsupportedReason: "不能改後端程式",
      changes: [],
    });
    expect(result.ok).toBe(true);
  });
});
