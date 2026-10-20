import { defaultContent } from "@/lib/content/default-content";
import { siteContentSchema, type SiteContent } from "@/lib/content/schema";
import {
  createInitialState,
  discardState,
  publishState,
  revertState,
  type Revision,
  type SiteRepository,
  type SiteState,
} from "./types";

export interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

export interface D1Like {
  prepare(query: string): D1Prepared;
}

type DocumentRow = {
  draft_json: string;
  published_json: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  summary: string;
  created_at: string;
  published_json: string;
};

export class D1SiteRepository implements SiteRepository {
  constructor(private readonly db: D1Like) {}

  async getState(): Promise<SiteState> {
    return this.read();
  }

  async saveDraft(content: SiteContent): Promise<SiteState> {
    const state = await this.read();
    state.draft = siteContentSchema.parse(content);
    state.updatedAt = new Date().toISOString();
    await this.writeDocuments(state);
    return state;
  }

  async publish(summary: string): Promise<SiteState> {
    const state = publishState(await this.read(), summary);
    await this.writeAll(state);
    return state;
  }

  async discardDraft(): Promise<SiteState> {
    const state = discardState(await this.read());
    await this.writeDocuments(state);
    return state;
  }

  async revertLatest(): Promise<SiteState> {
    const state = revertState(await this.read());
    await this.writeAll(state);
    return state;
  }

  private async read(): Promise<SiteState> {
    const document = await this.db
      .prepare("SELECT draft_json, published_json, updated_at FROM site_documents WHERE id = ?")
      .bind("default")
      .first<DocumentRow>();
    if (!document) {
      const state = createInitialState(defaultContent);
      await this.writeAll(state);
      return state;
    }
    const revisions = await this.db
      .prepare(
        "SELECT id, summary, created_at, published_json FROM site_revisions ORDER BY created_at DESC LIMIT 20",
      )
      .bind()
      .all<RevisionRow>();
    return {
      draft: siteContentSchema.parse(JSON.parse(document.draft_json)),
      published: siteContentSchema.parse(JSON.parse(document.published_json)),
      updatedAt: document.updated_at,
      revisions: (revisions.results ?? []).map(toRevision),
    };
  }

  private async writeDocuments(state: SiteState): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO site_documents (id, draft_json, published_json, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           draft_json = excluded.draft_json,
           published_json = excluded.published_json,
           updated_at = excluded.updated_at`,
      )
      .bind("default", JSON.stringify(state.draft), JSON.stringify(state.published), state.updatedAt)
      .run();
  }

  private async writeAll(state: SiteState): Promise<void> {
    await this.writeDocuments(state);
    await this.db.prepare("DELETE FROM site_revisions").bind().run();
    for (const revision of state.revisions) {
      await this.db
        .prepare(
          "INSERT INTO site_revisions (id, summary, created_at, published_json) VALUES (?, ?, ?, ?)",
        )
        .bind(revision.id, revision.summary, revision.createdAt, JSON.stringify(revision.published))
        .run();
    }
  }
}

function toRevision(row: RevisionRow): Revision {
  return {
    id: row.id,
    summary: row.summary,
    createdAt: row.created_at,
    published: siteContentSchema.parse(JSON.parse(row.published_json)),
  };
}
