import type { BbPluginApi } from "@get-bb/plugin-sdk";
import type { Guide } from "./guide";
import type { Draft, DraftComment, Verdict } from "./draft";

export interface ReviewMeta {
  targetKey: string;
  kind: "pr" | "ref";
  number?: number;
  repo?: string;
  title?: string;
  author?: string;
  base?: string;
  head?: string;
  gitRef?: string;
  url?: string;
  status: "generating" | "ready" | "error";
  createdAt: number;
  projectId?: string;
  headSha?: string;
  cwd?: string;
}

export interface FileView {
  file: string;
  hash: string;
  viewedAt: number;
}

export interface AgentMessageContext {
  file?: string;
  startLine?: number;
  endLine?: number;
  /** Which column a line range was picked on (new vs old file). */
  side?: "additions" | "deletions";
  code?: string;
  chapterId?: string;
}

export interface AgentMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  context: AgentMessageContext | null;
  createdAt: number;
}

export interface Store {
  saveReview(meta: ReviewMeta): void;
  getReview(targetKey: string): ReviewMeta | null;
  listReviews(): ReviewMeta[];
  setStatus(targetKey: string, status: ReviewMeta["status"]): void;
  savePatch(targetKey: string, patch: string): void;
  readPatch(targetKey: string, offset?: number, limit?: number): { text: string; total: number };
  saveGuide(targetKey: string, guide: Guide): void;
  getGuide(targetKey: string): Guide | null;
  getDraft(targetKey: string): Draft;
  upsertDraftComment(targetKey: string, c: DraftComment): Draft;
  removeDraftComment(targetKey: string, index: number): Draft;
  setVerdict(targetKey: string, verdict: Verdict, body: string): Draft;
  // Per-file "Viewed" state (Feature 1).
  getFileViews(targetKey: string): FileView[];
  setFileViewed(targetKey: string, file: string, hash: string): void;
  unsetFileViewed(targetKey: string, file: string): void;
  // Persistent review-agent thread + in-panel chat log (Feature 3).
  getAgentThread(targetKey: string): string | null;
  setAgentThread(targetKey: string, threadId: string): void;
  listAgentMessages(targetKey: string): AgentMessage[];
  appendAgentMessage(
    targetKey: string,
    role: AgentMessage["role"],
    text: string,
    context?: AgentMessageContext,
  ): AgentMessage;
}

export function createStore(bb: BbPluginApi): Store {
  const db = bb.storage.database();
  bb.storage.migrate(db, [
    `CREATE TABLE IF NOT EXISTS reviews (
      target_key TEXT PRIMARY KEY, kind TEXT NOT NULL, number INTEGER, repo TEXT,
      title TEXT, author TEXT, base TEXT, head TEXT, git_ref TEXT, url TEXT,
      status TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS patches (target_key TEXT PRIMARY KEY, patch TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS guides (target_key TEXT PRIMARY KEY, guide TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS drafts (target_key TEXT PRIMARY KEY, verdict TEXT NOT NULL, body TEXT NOT NULL, comments TEXT NOT NULL)`,
    `ALTER TABLE reviews ADD COLUMN project_id TEXT`,
    `ALTER TABLE reviews ADD COLUMN head_sha TEXT`,
    `ALTER TABLE reviews ADD COLUMN cwd TEXT`,
    `CREATE TABLE IF NOT EXISTS file_views (
      target_key TEXT NOT NULL, file TEXT NOT NULL,
      hash TEXT NOT NULL, viewed_at INTEGER NOT NULL,
      PRIMARY KEY (target_key, file))`,
    `CREATE TABLE IF NOT EXISTS agent_threads (
      target_key TEXT PRIMARY KEY, thread_id TEXT NOT NULL, created_at INTEGER NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS agent_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, target_key TEXT NOT NULL,
      role TEXT NOT NULL, text TEXT NOT NULL, context TEXT, created_at INTEGER NOT NULL)`,
  ]);

  const rowToMeta = (r: any): ReviewMeta => ({
    targetKey: r.target_key, kind: r.kind, number: r.number ?? undefined, repo: r.repo ?? undefined,
    title: r.title ?? undefined, author: r.author ?? undefined, base: r.base ?? undefined,
    head: r.head ?? undefined, gitRef: r.git_ref ?? undefined, url: r.url ?? undefined,
    status: r.status, createdAt: r.created_at, projectId: r.project_id ?? undefined,
    headSha: r.head_sha ?? undefined, cwd: r.cwd ?? undefined,
  });

  return {
    saveReview(m) {
      db.prepare(
        `INSERT INTO reviews (target_key,kind,number,repo,title,author,base,head,git_ref,url,status,created_at,project_id,head_sha,cwd)
         VALUES (@targetKey,@kind,@number,@repo,@title,@author,@base,@head,@gitRef,@url,@status,@createdAt,@projectId,@headSha,@cwd)
         ON CONFLICT(target_key) DO UPDATE SET
           kind=@kind,number=@number,repo=@repo,title=@title,author=@author,base=@base,head=@head,
           git_ref=@gitRef,url=@url,status=@status,created_at=@createdAt,project_id=@projectId,
           head_sha=@headSha,cwd=@cwd`,
      ).run({
        targetKey: m.targetKey, kind: m.kind, number: m.number ?? null, repo: m.repo ?? null,
        title: m.title ?? null, author: m.author ?? null, base: m.base ?? null, head: m.head ?? null,
        gitRef: m.gitRef ?? null, url: m.url ?? null, status: m.status, createdAt: m.createdAt,
        projectId: m.projectId ?? null, headSha: m.headSha ?? null, cwd: m.cwd ?? null,
      });
    },
    getReview(k) {
      const r = db.prepare(`SELECT * FROM reviews WHERE target_key=?`).get(k);
      return r ? rowToMeta(r) : null;
    },
    listReviews() {
      return db.prepare(`SELECT * FROM reviews ORDER BY created_at DESC`).all().map(rowToMeta);
    },
    setStatus(k, status) {
      db.prepare(`UPDATE reviews SET status=? WHERE target_key=?`).run(status, k);
    },
    savePatch(k, patch) {
      db.prepare(
        `INSERT INTO patches (target_key,patch) VALUES (?,?)
         ON CONFLICT(target_key) DO UPDATE SET patch=excluded.patch`,
      ).run(k, patch);
    },
    readPatch(k, offset = 0, limit = 200_000) {
      const row: any = db.prepare(`SELECT patch FROM patches WHERE target_key=?`).get(k);
      const text = row?.patch ?? "";
      return { text: text.slice(offset, offset + limit), total: text.length };
    },
    saveGuide(k, guide) {
      db.prepare(
        `INSERT INTO guides (target_key,guide) VALUES (?,?)
         ON CONFLICT(target_key) DO UPDATE SET guide=excluded.guide`,
      ).run(k, JSON.stringify(guide));
    },
    getGuide(k) {
      const row: any = db.prepare(`SELECT guide FROM guides WHERE target_key=?`).get(k);
      return row ? (JSON.parse(row.guide) as Guide) : null;
    },
    getDraft(k) {
      const row: any = db.prepare(`SELECT * FROM drafts WHERE target_key=?`).get(k);
      if (!row) return { targetKey: k, verdict: "COMMENT", body: "", comments: [] };
      return { targetKey: k, verdict: row.verdict, body: row.body, comments: JSON.parse(row.comments) };
    },
    upsertDraftComment(k, c) {
      const d = this.getDraft(k);
      const i = d.comments.findIndex((x) => x.file === c.file && x.line === c.line && x.side === c.side);
      if (i >= 0) d.comments[i] = c; else d.comments.push(c);
      writeDraft(db, d);
      return d;
    },
    removeDraftComment(k, index) {
      const d = this.getDraft(k);
      d.comments.splice(index, 1);
      writeDraft(db, d);
      return d;
    },
    setVerdict(k, verdict, body) {
      const d = this.getDraft(k);
      d.verdict = verdict; d.body = body;
      writeDraft(db, d);
      return d;
    },
    getFileViews(k) {
      return db
        .prepare(`SELECT file, hash, viewed_at FROM file_views WHERE target_key=?`)
        .all(k)
        .map((r: any) => ({ file: r.file, hash: r.hash, viewedAt: r.viewed_at }));
    },
    setFileViewed(k, file, hash) {
      db.prepare(
        `INSERT INTO file_views (target_key,file,hash,viewed_at) VALUES (?,?,?,?)
         ON CONFLICT(target_key,file) DO UPDATE SET hash=excluded.hash, viewed_at=excluded.viewed_at`,
      ).run(k, file, hash, Date.now());
    },
    unsetFileViewed(k, file) {
      db.prepare(`DELETE FROM file_views WHERE target_key=? AND file=?`).run(k, file);
    },
    getAgentThread(k) {
      const row: any = db.prepare(`SELECT thread_id FROM agent_threads WHERE target_key=?`).get(k);
      return row?.thread_id ?? null;
    },
    setAgentThread(k, threadId) {
      db.prepare(
        `INSERT INTO agent_threads (target_key,thread_id,created_at) VALUES (?,?,?)
         ON CONFLICT(target_key) DO UPDATE SET thread_id=excluded.thread_id`,
      ).run(k, threadId, Date.now());
    },
    listAgentMessages(k) {
      return db
        .prepare(`SELECT id, role, text, context, created_at FROM agent_messages WHERE target_key=? ORDER BY id ASC`)
        .all(k)
        .map((r: any) => ({
          id: r.id,
          role: r.role,
          text: r.text,
          context: r.context ? (JSON.parse(r.context) as AgentMessageContext) : null,
          createdAt: r.created_at,
        }));
    },
    appendAgentMessage(k, role, text, context) {
      const createdAt = Date.now();
      const ctx = context ? JSON.stringify(context) : null;
      const info = db
        .prepare(`INSERT INTO agent_messages (target_key,role,text,context,created_at) VALUES (?,?,?,?,?)`)
        .run(k, role, text, ctx, createdAt);
      return { id: Number(info.lastInsertRowid), role, text, context: context ?? null, createdAt };
    },
  };
}

function writeDraft(db: any, d: Draft) {
  db.prepare(
    `INSERT INTO drafts (target_key,verdict,body,comments) VALUES (?,?,?,?)
     ON CONFLICT(target_key) DO UPDATE SET verdict=excluded.verdict,body=excluded.body,comments=excluded.comments`,
  ).run(d.targetKey, d.verdict, d.body, JSON.stringify(d.comments));
}
