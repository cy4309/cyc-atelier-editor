import type { SiteContent } from "@/lib/content/schema";

export type Revision = {
  id: string;
  summary: string;
  createdAt: string;
  published: SiteContent;
};

export type SiteState = {
  draft: SiteContent;
  published: SiteContent;
  updatedAt: string;
  revisions: Revision[];
};

export interface SiteRepository {
  getState(): Promise<SiteState>;
  saveDraft(content: SiteContent): Promise<SiteState>;
  publish(summary: string): Promise<SiteState>;
  discardDraft(): Promise<SiteState>;
  revertLatest(): Promise<SiteState>;
}

export const REVISION_LIMIT = 20;

export function cloneContent(content: SiteContent): SiteContent {
  return structuredClone(content);
}

export function createInitialState(content: SiteContent, now = new Date().toISOString()): SiteState {
  const copy = cloneContent(content);
  return {
    draft: copy,
    published: cloneContent(copy),
    updatedAt: now,
    revisions: [],
  };
}

export function publishState(state: SiteState, summary: string, now = new Date().toISOString()): SiteState {
  const revision: Revision = {
    id: crypto.randomUUID(),
    summary: summary.trim() || "發布草稿",
    createdAt: now,
    published: cloneContent(state.published),
  };
  return {
    draft: cloneContent(state.draft),
    published: cloneContent(state.draft),
    updatedAt: now,
    revisions: [revision, ...state.revisions].slice(0, REVISION_LIMIT),
  };
}

export function discardState(state: SiteState, now = new Date().toISOString()): SiteState {
  return {
    ...state,
    draft: cloneContent(state.published),
    updatedAt: now,
  };
}

export function revertState(state: SiteState, now = new Date().toISOString()): SiteState {
  const [previous, ...rest] = state.revisions;
  if (!previous) {
    throw new Error("沒有可復原的已發布版本");
  }
  return {
    draft: cloneContent(previous.published),
    published: cloneContent(previous.published),
    updatedAt: now,
    revisions: rest,
  };
}
