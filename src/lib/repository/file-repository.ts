import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultContent } from "@/lib/content/default-content";
import { siteContentSchema, type SiteContent } from "@/lib/content/schema";
import {
  createInitialState,
  discardState,
  publishState,
  revertState,
  type SiteRepository,
  type SiteState,
} from "./types";

type FileRepositoryOptions = {
  filePath: string;
};

export class FileSiteRepository implements SiteRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private readonly filePath: string;

  constructor(options: FileRepositoryOptions) {
    this.filePath = options.filePath;
  }

  getState(): Promise<SiteState> {
    return this.locked(() => this.read());
  }

  saveDraft(content: SiteContent): Promise<SiteState> {
    return this.locked(async () => {
      const state = await this.read();
      state.draft = siteContentSchema.parse(content);
      state.updatedAt = new Date().toISOString();
      await this.write(state);
      return state;
    });
  }

  publish(summary: string): Promise<SiteState> {
    return this.locked(async () => {
      const state = publishState(await this.read(), summary);
      await this.write(state);
      return state;
    });
  }

  discardDraft(): Promise<SiteState> {
    return this.locked(async () => {
      const state = discardState(await this.read());
      await this.write(state);
      return state;
    });
  }

  revertLatest(): Promise<SiteState> {
    return this.locked(async () => {
      const state = revertState(await this.read());
      await this.write(state);
      return state;
    });
  }

  private locked<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async read(): Promise<SiteState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return parseState(JSON.parse(raw));
    } catch (error) {
      if (isMissingFile(error)) {
        const state = createInitialState(defaultContent);
        await this.write(state);
        return state;
      }
      throw error;
    }
  }

  private async write(state: SiteState): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state), "utf8");
  }
}

function parseState(input: unknown): SiteState {
  if (!input || typeof input !== "object") throw new Error("網站資料格式不正確");
  const value = input as Partial<SiteState>;
  return {
    draft: siteContentSchema.parse(value.draft),
    published: siteContentSchema.parse(value.published),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : new Date().toISOString(),
    revisions: Array.isArray(value.revisions)
      ? value.revisions.map((revision) => {
          const item = revision as SiteState["revisions"][number];
          return {
            id: String(item.id),
            summary: String(item.summary),
            createdAt: String(item.createdAt),
            published: siteContentSchema.parse(item.published),
          };
        })
      : [],
  };
}

function isMissingFile(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

let singleton: FileSiteRepository | null = null;

export function getFileRepository(): FileSiteRepository {
  if (!singleton) {
    const filePath = process.env.SITE_DATA_PATH
      ? path.resolve(process.env.SITE_DATA_PATH)
      : path.join(process.cwd(), ".data", "site.json");
    singleton = new FileSiteRepository({ filePath });
  }
  return singleton;
}
