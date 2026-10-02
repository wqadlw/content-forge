// 内容车间（批次 HS10-F2/F3）：素材池浏览、成稿台账、pin 选题短名单、人工抽检判定。
// 素材池 = publications（采集侧，eligible/selected 筛选）；台账 = article_writes（成稿侧，状态分布）。
// pin（F3）= 车间编辑"必写"短名单：writeBatch 候选 pinned 优先；抽检（F3）= 台账 quality 判定（pass/off-topic/style）。
import type { BeforeJson } from "@aihot/contracts/admin";
import { audit } from "../audit.ts";
import { sql } from "../db.ts";

export interface ForgeMaterialRow {
  article_id: string;
  title: string;
  summary: string | null;
  source_name: string;
  tier: string;
  selected: boolean;
  published_at: Date;
  story_id: string | null;
  written: boolean;
  pinned: boolean;
}

export async function materialsOverview(filter: "eligible" | "selected" | "all", page: number, limit = 30): Promise<{ rows: BeforeJson<ForgeMaterialRow>[]; total: number }> {
  const where =
    filter === "eligible" ? sql`AND p.eligible` : filter === "selected" ? sql`AND p.selected` : sql``;
  const offset = (page - 1) * limit;
  const rows = await sql<BeforeJson<ForgeMaterialRow>[]>`
    SELECT p.article_id, p.title, left(p.summary, 160) AS summary, s.name AS source_name, s.tier,
           p.selected, p.published_at, p.story_id,
           EXISTS (SELECT 1 FROM article_writes w WHERE w.article_id = p.article_id) AS written,
           EXISTS (SELECT 1 FROM forge_pins f WHERE f.article_id = p.article_id) AS pinned
    FROM publications p JOIN sources s ON s.id = p.source_id
    WHERE 1 = 1 ${where}
    ORDER BY p.selected DESC, p.published_at DESC
    LIMIT ${limit} OFFSET ${offset}`;
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM publications p WHERE 1 = 1 ${where}`;
  return { rows, total: n };
}

export interface ForgeWriteRow {
  article_id: string;
  status: string;
  genre: string;
  title: string;
  slug: string;
  reject_reason: string | null;
  quality: string | null;
  quality_note: string | null;
  quality_by: string | null;
  imported_at: Date | null;
  created_at: Date;
}

export async function writesLedger(status: string, page: number, limit = 30): Promise<{ rows: BeforeJson<ForgeWriteRow>[]; total: number; stats: Record<string, number>; passRate: number | null }> {
  const where = status ? sql`WHERE w.status = ${status}` : sql``;
  const offset = (page - 1) * limit;
  const rows = await sql<BeforeJson<ForgeWriteRow>[]>`
    SELECT w.article_id, w.status, w.genre, w.title, w.slug, w.reject_reason, w.quality, w.quality_note, w.quality_by, w.imported_at, w.created_at
    FROM article_writes w ${where}
    ORDER BY w.created_at DESC
    LIMIT ${limit} OFFSET ${offset}`;
  const [{ n }] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM article_writes w ${where}`;
  const statRows = await sql<{ status: string; n: number }[]>`SELECT status, count(*)::int AS n FROM article_writes GROUP BY 1`;
  const stats: Record<string, number> = {};
  for (const r of statRows) stats[r.status] = r.n;
  /* 抽检合格率（Phase D 提速判据的数据源）：已抽检样本中 pass 占比 */
  const [rate] = await sql<{ reviewed: number; passed: number }[]>`
    SELECT count(*)::int AS reviewed,
           count(*) FILTER (WHERE quality = 'pass')::int AS passed
    FROM article_writes WHERE quality IS NOT NULL`;
  const passRate = rate && rate.reviewed > 0 ? Math.round((rate.passed / rate.reviewed) * 100) : null;
  return { rows, total: n, stats, passRate };
}

/** pin：车间编辑"必写"短名单（writeBatch 候选优先；不豁免相关性门与质量门）。 */
export async function pinArticle(articleId: string, by: string): Promise<void> {
  await sql`INSERT INTO forge_pins (article_id, pinned_by) VALUES (${articleId}, ${by}) ON CONFLICT (article_id) DO NOTHING`;
  await audit(by, "forge.pin", "publication", "素材池手动选题", null, { article_id: articleId });
}

export async function unpinArticle(articleId: string, by: string): Promise<void> {
  await sql`DELETE FROM forge_pins WHERE article_id = ${articleId}`;
  await audit(by, "forge.unpin", "publication", "素材池取消选题", null, { article_id: articleId });
}

const QUALITY_VERDICTS = new Set(["pass", "off-topic", "style"]);

/** 抽检判定：verdict 白名单（pass/off-topic/style），落台账（行不可变原则外的受控列更新，审计留痕）。 */
export async function reviewQuality(articleId: string, verdict: string, note: string, by: string): Promise<void> {
  if (!QUALITY_VERDICTS.has(verdict)) throw new Error(`quality verdict 仅限 pass|off-topic|style`);
  const res = await sql`UPDATE article_writes SET quality = ${verdict}, quality_note = ${note}, quality_by = ${by}, quality_at = now() WHERE article_id = ${articleId} AND status = 'written' RETURNING article_id`;
  if (res.length === 0) throw new Error(`台账中无此成稿或状态非 written`);
  await audit(by, `forge.quality.${verdict}`, "article_write", note || null, null, { article_id: articleId, verdict });
}
