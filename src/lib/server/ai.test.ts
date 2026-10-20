import { describe, expect, it } from "vitest";
import { extractJson, sanitizeProposal } from "./ai";
import { validateProposal } from "@/lib/content/patch";

describe("AI payload parsing", () => {
  it("reads Workers AI JSON mode payloads and drops unknown keys", () => {
    const extracted = extractJson({
      response: JSON.stringify({
        summary: "更新標題",
        unsupportedReason: null,
        extra: true,
        changes: [{ op: "replace", path: "hero.title", value: "讓日常多一點靈感", note: "ignore" }],
      }),
    });
    expect(extracted.ok).toBe(true);
    if (!extracted.ok) return;
    const proposal = validateProposal(sanitizeProposal(extracted.value));
    expect(proposal.ok).toBe(true);
    if (!proposal.ok) return;
    expect(proposal.proposal.changes[0]).toEqual({
      op: "replace",
      path: "hero.title",
      value: "讓日常多一點靈感",
    });
  });
});
