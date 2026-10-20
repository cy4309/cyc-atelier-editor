"use client";

import { useMemo, useState, type FormEvent } from "react";
import { FieldEditor } from "@/components/admin/field-editor";
import { SiteView } from "@/components/site/site-view";
import { promptExamples } from "@/lib/content/default-content";
import { applyPatch, describeChange } from "@/lib/content/patch";
import type { ContentChange, SiteContent } from "@/lib/content/schema";
import { formatTaipeiTimestamp } from "@/lib/format-timestamp";

type RevisionInfo = { id: string; summary: string; createdAt: string };

type EditorPayload = {
  ok: true;
  draft: SiteContent;
  published: SiteContent;
  updatedAt: string;
  dirty: boolean;
  revisions: RevisionInfo[];
  devBypass: boolean;
  aiConfigured: boolean;
};

export type StudioInitial = Omit<EditorPayload, "ok">;

type Proposal = {
  summary: string;
  changes: ContentChange[];
  descriptions: string[];
};

export function AdminStudio({
  initial,
  needsLogin: startsLoggedOut,
  bootError = "",
}: {
  initial: StudioInitial | null;
  needsLogin: boolean;
  bootError?: string;
}) {
  const [payload, setPayload] = useState<EditorPayload | null>(initial ? { ok: true, ...initial } : null);
  const [editor, setEditor] = useState<SiteContent | null>(initial?.draft ?? null);
  const [prompt, setPrompt] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<boolean[]>([]);
  const [previewSource, setPreviewSource] = useState<"draft" | "suggestion">("draft");
  const [narrowPreview, setNarrowPreview] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(startsLoggedOut);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState(
    bootError ? "讀取失敗" : initial ? (initial.dirty ? "草稿與正式版本不同。" : "草稿與正式版本一致。") : "請輸入管理權杖。",
  );
  const [error, setError] = useState(bootError);
  const [busy, setBusy] = useState("");

  async function refresh() {
    const response = await fetch("/api/admin/state", { cache: "no-store" });
    const body = await response.json();
    if (response.status === 401) {
      setNeedsLogin(true);
      setStatus("請輸入管理權杖。");
      return;
    }
    if (!body.ok) {
      setError(body.error ?? "無法讀取內容");
      setStatus("讀取失敗");
      return;
    }
    setNeedsLogin(false);
    setPayload(body);
    setEditor(body.draft);
    setStatus(body.dirty ? "草稿與正式版本不同。" : "草稿與正式版本一致。");
  }

  const editorDirty = useMemo(
    () => Boolean(editor && payload && JSON.stringify(editor) !== JSON.stringify(payload.draft)),
    [editor, payload],
  );

  const preview = useMemo(() => {
    if (!editor || !payload) return null;
    if (previewSource === "suggestion" && proposal) {
      const changes = proposal.changes.filter((_, index) => selected[index]);
      if (changes.length === 0) return payload.draft;
      const applied = applyPatch(payload.draft, changes);
      return applied.ok ? applied.content : payload.draft;
    }
    return editor;
  }, [editor, payload, previewSource, proposal, selected]);

  async function sendPrompt() {
    setError("");
    setBusy("ai");
    setStatus("正在把 Prompt 送給 AI…");
    try {
      const response = await fetch("/api/admin/ai", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const body = await response.json();
      if (!body.ok) {
        setProposal(null);
        setError(body.error ?? "AI 沒有完成修改");
        setStatus("AI 沒有修改草稿。");
        return;
      }
      setProposal(body);
      setSelected(body.changes.map(() => true));
      setPreviewSource("suggestion");
      setStatus("這是 AI 建議，尚未寫入草稿。");
    } catch {
      setError("AI 請求失敗，草稿沒有被修改。");
      setStatus("AI 沒有修改草稿。");
    } finally {
      setBusy("");
    }
  }

  async function applySuggestion() {
    if (!proposal) return;
    const changes = proposal.changes.filter((_, index) => selected[index]);
    if (changes.length === 0) {
      setError("請至少勾選一項變更。");
      return;
    }
    setError("");
    setBusy("apply");
    try {
      const response = await fetch("/api/admin/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ changes }),
      });
      const body = await response.json();
      if (!body.ok) {
        setError(body.error ?? "套用失敗");
        return;
      }
      adopt(body);
      setProposal(null);
      setPreviewSource("draft");
      setStatus("已套用到草稿，正式網站尚未改變。");
    } finally {
      setBusy("");
    }
  }

  async function saveFields() {
    if (!editor) return;
    setError("");
    setBusy("save");
    try {
      const response = await fetch("/api/admin/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: editor }),
      });
      const body = await response.json();
      if (!body.ok) {
        setError(body.error ?? "草稿儲存失敗");
        return;
      }
      adopt(body);
      setStatus("欄位已存成草稿，正式網站尚未改變。");
    } finally {
      setBusy("");
    }
  }

  async function publish() {
    setError("");
    setBusy("publish");
    try {
      const response = await fetch("/api/admin/publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ summary: proposal?.summary || "發布草稿" }),
      });
      const body = await response.json();
      if (!body.ok) {
        setError(body.error ?? "發布失敗");
        return;
      }
      adopt(body);
      setProposal(null);
      setStatus("已發布。公開網站現在讀取這個版本。");
    } finally {
      setBusy("");
    }
  }

  async function runSimple(path: string, success: string) {
    setError("");
    setBusy(path);
    try {
      const response = await fetch(path, { method: "POST" });
      const body = await response.json();
      if (!body.ok) {
        setError(body.error ?? "操作失敗");
        return;
      }
      adopt(body);
      setProposal(null);
      setPreviewSource("draft");
      setStatus(success);
    } finally {
      setBusy("");
    }
  }

  function adopt(body: Omit<EditorPayload, "ok" | "devBypass" | "aiConfigured">) {
    setPayload((current) => ({
      ...body,
      ok: true,
      devBypass: current?.devBypass ?? false,
      aiConfigured: current?.aiConfigured ?? false,
    }));
    setEditor(body.draft);
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy("login");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = await response.json();
      if (!body.ok) {
        setError(body.error ?? "無法登入");
        return;
      }
      setToken("");
      await refresh();
    } finally {
      setBusy("");
    }
  }

  if (needsLogin) {
    return (
      <main className="studio-login">
        <form onSubmit={login} className="studio-card">
          <p className="text-sm font-medium text-stone-500">CYC Atelier</p>
          <h1 className="mt-2 text-2xl font-semibold">管理後台</h1>
          <p className="mt-2 text-sm leading-6 text-stone-600">輸入伺服器設定的管理權杖。權杖不會出現在公開網站。</p>
          <label className="mt-5 grid gap-1 text-sm font-medium" htmlFor="admin-token">
            管理權杖
            <input id="admin-token" type="password" autoComplete="current-password" value={token} onChange={(event) => setToken(event.target.value)} required />
          </label>
          {error ? <p className="studio-error" role="alert">{error}</p> : null}
          <button className="studio-primary mt-4" type="submit" disabled={busy === "login"}>進入編輯器</button>
        </form>
      </main>
    );
  }

  return (
    <div className="studio">
      <header className="studio-top">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-stone-500">CYC ATELIER</p>
          <h1 className="text-lg font-semibold">網站編輯器</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="studio-chip">草稿</span>
          <span className={payload?.dirty ? "studio-chip studio-chip-warn" : "studio-chip"}>
            {payload?.dirty ? "尚未發布" : "已與正式版相同"}
          </span>
          <a className="studio-secondary" href="/" target="_blank" rel="noreferrer">開啟正式網站</a>
        </div>
      </header>
      <div className="studio-grid">
        <section className="studio-panel" aria-label="編輯操作">
          {payload?.devBypass ? (
            <p className="studio-note">開發模式：尚未設定 ADMIN_TOKEN，本機寫入暫時開放。部署前必須設定權杖。</p>
          ) : null}
          {payload && !payload.aiConfigured ? (
            <p className="studio-note" role="status">
              尚未設定 AI。請綁定 Cloudflare Workers AI，或在伺服器環境變數設定 CLOUDFLARE_ACCOUNT_ID 與 CLOUDFLARE_API_TOKEN。未設定時不會假裝修改成功。
            </p>
          ) : null}
          <label className="grid gap-2 text-sm font-semibold" htmlFor="prompt">
            告訴編輯器要改什麼
            <textarea
              id="prompt"
              rows={5}
              maxLength={2000}
              value={prompt}
              placeholder="例如：把首頁主標題改成：讓日常多一點靈感"
              onChange={(event) => setPrompt(event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2" aria-label="Prompt 例句">
            {promptExamples.map((example) => (
              <button key={example} className="studio-example" type="button" onClick={() => setPrompt(example)}>
                {example}
              </button>
            ))}
          </div>
          <button className="studio-primary" type="button" onClick={() => void sendPrompt()} disabled={Boolean(busy) || !prompt.trim()}>
            {busy === "ai" ? "AI 處理中…" : "送給 AI"}
          </button>
          <p className="text-sm text-stone-600" role="status">{status}</p>
          {error ? <p className="studio-error" role="alert">{error}</p> : null}
          {proposal ? (
            <div className="studio-card">
              <p className="text-xs font-semibold tracking-wide text-stone-500">AI 建議的變更</p>
              <h2 className="mt-1 text-base font-semibold">{proposal.summary}</h2>
              <ul className="mt-3 grid gap-2">
                {proposal.changes.map((change, index) => (
                  <li key={`${describeChange(change)}-${index}`}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selected[index] ?? false}
                        onChange={(event) => {
                          const next = selected.slice();
                          next[index] = event.target.checked;
                          setSelected(next);
                        }}
                      />
                      <span>{proposal.descriptions[index] ?? describeChange(change)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button className="studio-primary mt-3" type="button" onClick={() => void applySuggestion()} disabled={Boolean(busy) || editorDirty}>
                {busy === "apply" ? "套用中…" : "套用到草稿"}
              </button>
              {editorDirty ? <p className="mt-2 text-sm text-stone-600">欄位編輯尚未儲存，請先儲存或還原後再套用 AI 建議。</p> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button className="studio-primary" type="button" onClick={() => void publish()} disabled={Boolean(busy) || !payload?.dirty || editorDirty}>
              {busy === "publish" ? "發布中…" : "發布修改"}
            </button>
            <button className="studio-secondary" type="button" onClick={() => void runSimple("/api/admin/discard", "已放棄草稿，恢復成正式版本。")} disabled={Boolean(busy) || !payload?.dirty}>
              放棄草稿
            </button>
            <button className="studio-secondary" type="button" onClick={() => void runSimple("/api/admin/revert", "已復原上一個已發布版本。")} disabled={Boolean(busy) || !payload?.revisions.length}>
              復原上一版
            </button>
          </div>
          <div>
            <h2 className="text-sm font-semibold">最近的發布紀錄</h2>
            {payload?.revisions.length ? (
              <ul className="mt-2 grid gap-2">
                {payload.revisions.map((revision) => (
                  <li key={revision.id} className="text-sm text-stone-600">
                    <time dateTime={revision.createdAt}>{formatTaipeiTimestamp(revision.createdAt)}</time>
                    <span> · {revision.summary}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-500">還沒有可復原的已發布版本。</p>
            )}
          </div>
          <details className="studio-card">
            <summary className="cursor-pointer text-sm font-semibold">直接編輯欄位</summary>
            {editor ? (
              <div className="mt-4">
                <FieldEditor content={editor} onChange={setEditor} />
                <div className="mt-4 flex gap-2">
                  <button className="studio-primary" type="button" onClick={() => void saveFields()} disabled={Boolean(busy) || !editorDirty}>
                    {busy === "save" ? "儲存中…" : "儲存為草稿"}
                  </button>
                  <button className="studio-secondary" type="button" onClick={() => payload && setEditor(payload.draft)} disabled={!editorDirty}>
                    還原未儲存欄位
                  </button>
                </div>
              </div>
            ) : null}
          </details>
        </section>
        <section className="studio-preview" aria-label="網站預覽">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2">
              <button className={previewSource === "draft" ? "studio-primary" : "studio-secondary"} type="button" onClick={() => setPreviewSource("draft")}>目前草稿</button>
              <button className={previewSource === "suggestion" ? "studio-primary" : "studio-secondary"} type="button" onClick={() => setPreviewSource("suggestion")} disabled={!proposal}>AI 建議</button>
            </div>
            <button className="studio-secondary" type="button" onClick={() => setNarrowPreview((value) => !value)}>
              {narrowPreview ? "桌面寬度" : "手機寬度"}
            </button>
          </div>
          <p className="mb-3 text-sm text-stone-600">
            {previewSource === "suggestion" ? "正在預覽勾選的 AI 建議，尚未寫入草稿，也尚未發布。" : editorDirty ? "正在預覽未儲存的欄位，按下「儲存為草稿」後才會進入草稿。" : "正在預覽目前草稿。正式網站要等發布後才會改變。"}
          </p>
          <div className={narrowPreview ? "preview-frame preview-frame-narrow" : "preview-frame"}>
            {preview ? <SiteView content={preview} /> : <p className="p-6 text-sm">載入預覽…</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
