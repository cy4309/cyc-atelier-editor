import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultContent } from "@/lib/content/default-content";
import { FileSiteRepository } from "./file-repository";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("draft and publish flow", () => {
  it("keeps drafts off the published site until publish, then restores the previous version", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "cyc-site-"));
    directories.push(directory);
    const repository = new FileSiteRepository({ filePath: path.join(directory, "site.json") });

    const initial = await repository.getState();
    expect(initial.published.hero.title).toBe(defaultContent.hero.title);

    const draft = structuredClone(initial.draft);
    draft.hero.title = "讓日常多一點靈感";
    const saved = await repository.saveDraft(draft);
    expect(saved.draft.hero.title).toBe("讓日常多一點靈感");
    expect(saved.published.hero.title).toBe(defaultContent.hero.title);

    const discarded = await repository.discardDraft();
    expect(discarded.draft.hero.title).toBe(defaultContent.hero.title);

    const again = structuredClone(discarded.draft);
    again.contact.buttonLabel = "預約諮詢";
    await repository.saveDraft(again);
    const published = await repository.publish("更新聯絡按鈕");
    expect(published.published.contact.buttonLabel).toBe("預約諮詢");
    expect(published.revisions).toHaveLength(1);
    expect(published.revisions[0]?.published.contact.buttonLabel).toBe("寫信給我們");

    const reverted = await repository.revertLatest();
    expect(reverted.published.contact.buttonLabel).toBe("寫信給我們");
    expect(reverted.draft.contact.buttonLabel).toBe("寫信給我們");
    expect(reverted.revisions).toHaveLength(0);
    await expect(repository.revertLatest()).rejects.toThrow("沒有可復原");
  });
});
