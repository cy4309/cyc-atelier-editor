import { describe, expect, it } from "vitest";
import { formatTaipeiTimestamp } from "./format-timestamp";

describe("formatTaipeiTimestamp", () => {
  it("formats an afternoon timestamp with a normal space", () => {
    expect(formatTaipeiTimestamp("2026-10-20T07:51:12.624Z")).toBe("2026/10/20 下午3:51:12");
  });

  it("uses 下午12 for noon and 上午12 for midnight", () => {
    expect(formatTaipeiTimestamp("2026-10-20T04:00:00.000Z")).toBe("2026/10/20 下午12:00:00");
    expect(formatTaipeiTimestamp("2026-10-19T16:00:00.000Z")).toBe("2026/10/20 上午12:00:00");
  });

  it("returns the original text when the timestamp is invalid", () => {
    expect(formatTaipeiTimestamp("not-a-date")).toBe("not-a-date");
  });
});
