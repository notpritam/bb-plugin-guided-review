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
  ]);

  const rowToMeta = (r: any): ReviewMeta => ({
    targetKey: r.target_key, kind: r.kind, number: r.number ?? undefined, repo: r.repo ?? undefined,
    title: r.title ?? undefined, author: r.author ?? undefined, base: r.base ?? undefined,
    head: r.head ?? undefined, gitRef: r.git_ref ?? undefined, url: r.url ?? undefined,
    status: r.status, createdAt: r.created_at,
  });

  return {
    saveReview(m) {
      db.prepare(
        `INSERT INTO reviews (target_key,kind,number,repo,title,author,base,head,git_ref,url,status,created_at)
         VALUES (@targetKey,@kind,@number,@repo,@title,@author,@base,@head,@gitRef,@url,@status,@createdAt)
         ON CONFLICT(target_key) DO UPDATE SET
           kind=@kind,number=@number,repo=@repo,title=@title,author=@author,base=@base,head=@head,
           git_ref=@gitRef,url=@url,status=@status,created_at=@createdAt`,
      ).run({
        targetKey: m.targetKey, kind: m.kind, number: m.number ?? null, repo: m.repo ?? null,
        title: m.title ?? null, author: m.author ?? null, base: m.base ?? null, head: m.head ?? null,
        gitRef: m.gitRef ?? null, url: m.url ?? null, status: m.status, createdAt: m.createdAt,
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
  };
}

function writeDraft(db: any, d: Draft) {
  db.prepare(
    `INSERT INTO drafts (target_key,verdict,body,comments) VALUES (?,?,?,?)
     ON CONFLICT(target_key) DO UPDATE SET verdict=excluded.verdict,body=excluded.body,comments=excluded.comments`,
  ).run(d.targetKey, d.verdict, d.body, JSON.stringify(d.comments));
}
