// 内容车间成稿器（批次 HS10-F1 从 scripts/write-articles.ts 模块化）：把素材池里未成稿的真实条目，
// 按找真空写作模板（industry/prompts/style-*）写成整篇行业资讯。纪律：每篇锚定素材（原始标题/摘要/
// 来源/日期），写作=加工不=编造；选题相关性门（off-topic 不花成稿 token）+ 事件聚簇去重 + 确定性质量门
// （字数/禁词/元话语）不达标打回台账；台账防重复成稿。
// 定时：worker SCHEDULES 的 forge.write（工作日 06:40）调用 runForgeWrite，成品经 publishToSite 推送站点
// （推送目标来自部署环境变量，出网统一走 guardedFetch 的 SSRF 守卫）。
import { appendFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import { sql } from "../db.ts";
import { guardedFetch } from "../lib/http-fetch.ts";
import { chatJson } from "../providers/llm.ts";
import { modelFor } from "./models.ts";
import { promptText, promptVersion } from "./prompts.ts";

const asString = z.preprocess((v) => (Array.isArray(v) ? v.map(String).join(",") : v), z.string());

const Output = z.object({
  title: z.string(),
  summary: z.string(),
  seo_title: asString,
  seo_keywords: asString,
  seo_description: asString,
  body_paragraphs: z.array(z.string()).min(4).max(8),
});

/* 选题相关性门（HS8R）：真空设备/真空应用行业判定，跑题素材不花成稿 token */
const Relevance = z.object({ relevant: z.boolean(), reason: z.string() });
const RELEVANCE_SYSTEM = `你是找真空（真空行业 B2B 门户）的选题审核员。判断一条素材是否值得写成真空行业的行业资讯。
相关 = 真空设备/技术（泵、机组、法兰、检漏、镀膜设备、分子泵等）或真空应用行业动态（半导体、光伏、镀膜、冻干、真空包装、铸造、冶金、医药等场景里的真空环节、真空企业本身）。
不相关 = 仅偶然出现"真空泵"字样的其他行业故事（农牧、消费电子散热比喻、生活方式）、与真空无关的融资/经营动态、泛科技软文。
拿不准时判 false（宁缺毋滥）。只输出 JSON：{"relevant": bool, "reason": "一句话理由"}`;

const NEWS_SYSTEM = promptText("style-news");
const DEEPDIVE_SYSTEM = promptText("style-deepdive");
export const WRITE_PROMPT_VERSION = promptVersion("style-news", "style-deepdive", "rules-anti-hallucination");

/* 实测教训：「意味着」不带「这」也要拦（首篇试跑漏网）；元话语单独拦截 */
const BANNED = /(首先|其次|再次|最后|综上所述|总而言之|不难看出|值得注意的是|这意味着|意味着|标志着|无疑将|进一步彰显|赋能|新篇章|新高度|蓬勃发展)/;
const META = /(素材未披露|据素材|本素材|原始标题)/;
const cjk = (s: string): number => (s.match(/[一-鿿]/g) ?? []).length;

interface Candidate {
  article_id: string;
  title: string;
  original_title: string | null;
  summary: string | null;
  url: string | null;
  published_at: Date;
  source_name: string;
  tier: string;
  selected: boolean;
  story_id: string | null;
  pinned: boolean;
}

export interface WriteBatchOptions {
  limit?: number;
  minDate?: string;
  genre?: "news" | "deepdive" | "auto";
  jsonlPath?: string | null;
}

export interface WriteBatchResult {
  candidates: number;
  written: number;
  rejected: number;
  pushed: number;
  titles: Array<{ slug: string; title: string }>;
}

const slugFor = (title: string): string =>
  `zzk-${createHash("sha256").update(title).digest("hex").slice(0, 8)}`;

/** 成稿一批；站点配置（SITE_IMPORT_BASE/TOKEN）就绪时自动推送，否则只落台账（CLI JSONL 兜底）。 */
export async function writeBatch(opts: WriteBatchOptions = {}): Promise<WriteBatchResult> {
  const limit = opts.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error(`limit 须为 1..500，收到 ${limit}`);
  const minDate = opts.minDate ?? "2025-01-01";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(minDate)) throw new Error(`minDate 须为 YYYY-MM-DD`);
  const genreOpt = opts.genre ?? "auto";
  const result: WriteBatchResult = { candidates: 0, written: 0, rejected: 0, pushed: 0, titles: [] };

  const candidates = (await sql<Candidate[]>`
    SELECT p.article_id, p.title, p.original_title, p.summary, p.url, p.published_at, s.name AS source_name, s.tier, p.selected, p.story_id,
           (f.article_id IS NOT NULL) AS pinned
    FROM publications p
    JOIN sources s ON s.id = p.source_id
    LEFT JOIN forge_pins f ON f.article_id = p.article_id
    WHERE NOT EXISTS (SELECT 1 FROM article_writes w WHERE w.article_id = p.article_id)
      AND (coalesce(p.published_at, p.discovered_at) >= ${minDate}::timestamptz OR f.article_id IS NOT NULL)
      AND length(coalesce(p.summary, '')) >= 30
      AND (p.eligible OR f.article_id IS NOT NULL)
      AND s.name NOT LIKE '找真空%'
    ORDER BY (f.article_id IS NOT NULL) DESC, p.selected DESC, CASE s.tier WHEN 'T1' THEN 0 WHEN 'T1_5' THEN 1 ELSE 2 END, coalesce(p.published_at, p.discovered_at) DESC
    LIMIT ${limit * 2}`)
    /* 事件去重（HS8R）：同一 story 聚簇只成稿一篇（兆默一轮融资写过三篇的教训）。
     * pin（F3）例外：编辑点名的事件不受去重约束。 */
    .filter((c, i, all) => {
      if (c.pinned) return true;
      if (!c.story_id) return true;
      return !all.some((x, j) => j < i && x.story_id === c.story_id && !x.pinned);
    })
    .slice(0, limit);

  result.candidates = candidates.length;
  const rows: Array<Record<string, unknown>> = [];

  for (const c of candidates) {
    /* 选题相关性门（HS8R）：跑题素材直接记台账，不进入成稿 */
    let rel: z.infer<typeof Relevance> | null = null;
    try {
      const relRes = await chatJson({
        model: await modelFor("articleWrite"),
        purpose: "relevance_check",
        subject: `rel:${c.article_id}`,
        promptVersion: WRITE_PROMPT_VERSION,
        system: RELEVANCE_SYSTEM,
        user: JSON.stringify({ 素材标题: c.original_title ?? c.title, 摘要: c.summary, 来源: c.source_name }),
        schema: Relevance,
        temperature: 0,
        maxTokens: 300,
        timeoutMs: 60_000,
      });
      rel = relRes.data;
    } catch (e) {
      /* 判定失败按不相关处理（宁可漏稿不可跑题） */
      rel = { relevant: false, reason: `relevance check failed: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (!rel.relevant) {
      await sql`INSERT INTO article_writes (article_id, status, genre, title, slug, category, summary, seo_title, seo_keywords, seo_description, body, reject_reason, prompt_version)
        VALUES (${c.article_id}, 'rejected', 'news', ${c.title}, '', '', '', '', '', '', '', ${"off-topic: " + rel.reason}, ${WRITE_PROMPT_VERSION})`;
      result.rejected++;
      continue;
    }

    const genre = genreOpt === "auto" ? (cjk(c.summary ?? "") >= 200 ? "deepdive" : "news") : genreOpt;
    const system = genre === "deepdive" ? DEEPDIVE_SYSTEM : NEWS_SYSTEM;

    let data: z.infer<typeof Output> | null = null;
    let fail: string | null = null;

    for (let attempt = 0; attempt < 2 && !data; attempt++) {
      try {
        const res = await chatJson({
          model: await modelFor("articleWrite"),
          purpose: "article_write",
          subject: `pub:${c.article_id}#${attempt}`,
          promptVersion: WRITE_PROMPT_VERSION,
          system,
          user: JSON.stringify({
            素材原始标题: c.original_title ?? c.title,
            中文摘要: c.summary,
            来源: c.source_name,
            素材发布时间: c.published_at,
            体裁: genre === "deepdive" ? "深度报告体" : "资讯体",
            // JSON mode（response_format=json_object）要求 prompt 出现 "json"：这是输出契约，也顺带满足该约束
            输出要求: "只输出一个 JSON 对象：title、summary、seo_title、seo_keywords、seo_description、body_paragraphs（段落数组，纯文本无 Markdown）。写作红线：素材没有的信息直接不写，严禁出现「素材未披露」「据素材」「原始标题」等元话语——读者不该感知到素材的存在",
          }),
          schema: Output,
          temperature: 0.4,
          maxTokens: 3000,
          timeoutMs: 180_000,
          attemptTag: attempt > 0 ? "retry" : undefined,
        });
        data = res.data;
      } catch (e) {
        fail = `model: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    /* 确定性质量门：不过就打回台账，宁缺毋滥 */
    if (data) {
      const bodyText = data.body_paragraphs.join("");
      const failChecks: string[] = [];
      const total = cjk(bodyText);
      if (total < 400 || total > 1200) failChecks.push(`字数${total}`);
      if (BANNED.test(data.title) || BANNED.test(bodyText)) failChecks.push("禁词");
      if (META.test(bodyText)) failChecks.push("元话语");
      if (data.title.length < 12 || data.title.length > 40) failChecks.push(`标题${data.title.length}字`);
      if (cjk(data.summary) > 140) failChecks.push("摘要超140");
      if (failChecks.length > 0) fail = `gate: ${failChecks.join("、")}`;
    }

    if (!data) {
      await sql`INSERT INTO article_writes (article_id, status, genre, title, slug, category, summary, seo_title, seo_keywords, seo_description, body, reject_reason, prompt_version)
        VALUES (${c.article_id}, 'rejected', ${genre}, ${c.title}, '', '', '', '', '', '', '', ${fail ?? "unknown"}, ${WRITE_PROMPT_VERSION})`;
      result.rejected++;
      continue;
    }

    const slug = slugFor(data.title);
    const body = data.body_paragraphs.map((p) => `<p>${p.replace(/^[#*\-\s]+/, "").trim()}</p>`).join("\n")
      + `\n<p><em>找真空行业观察 · 综合自${c.source_name}等公开报道</em></p>`;

    await sql`INSERT INTO article_writes (article_id, status, genre, title, slug, category, summary, seo_title, seo_keywords, seo_description, body, prompt_version)
      VALUES (${c.article_id}, 'written', ${genre}, ${data.title}, ${slug}, 'industry', ${data.summary}, ${data.seo_title}, ${data.seo_keywords}, ${data.seo_description}, ${body}, ${WRITE_PROMPT_VERSION})`;

    rows.push({
      article_id: c.article_id,
      genre,
      title: data.title,
      slug,
      category: "industry",
      summary: data.summary,
      seo_title: data.seo_title,
      seo_keywords: data.seo_keywords,
      seo_description: data.seo_description,
      body,
      author: "找真空行业观察",
      source: c.source_name,
      source_url: c.url,
      material_published_at: c.published_at,
      featured: c.selected, // HS8：双评分过线素材的成稿 → 站点 is_featured=1（行业热点 tab 数据源）
    });
    result.written++;
    result.titles.push({ slug, title: data.title });
  }

  /* JSONL 交付（CLI 手动导入兼容） */
  if (opts.jsonlPath && rows.length > 0) {
    for (const row of rows) appendFileSync(opts.jsonlPath, JSON.stringify(row) + "\n");
  }

  /* 定时链路：自动推送站点 */
  if (rows.length > 0) {
    result.pushed = await publishToSite(rows);
  }

  return result;
}

/**
 * 成品推送站点（internal-api，X-Internal-Token 鉴权；批次 HS10-F1）。
 * 出网统一走 guardedFetch（SSRF 守卫）；站点未配置或失败时不抛错——台账已落，可重推或 CLI 导入兜底。
 */
export async function publishToSite(rows: Array<Record<string, unknown>>): Promise<number> {
  const base = process.env.SITE_IMPORT_BASE?.replace(/\/$/, "");
  const token = process.env.SITE_IMPORT_TOKEN;
  if (!base || !token || rows.length === 0) return 0;
  try {
    const resp = await guardedFetch(`${base}/internal-api/v1/content/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Token": token },
      body: JSON.stringify({ items: rows }),
      timeoutMs: 30_000,
      maxBytes: 8 * 1024 * 1024,
      maxRedirects: 0,
    });
    if (resp.status !== 200) return 0;
    const data = JSON.parse(resp.text()) as { created?: number };
    return data.created ?? 0;
  } catch {
    return 0;
  }
}

/** worker 定时入口（forge.write，工作日 06:40）：自动成稿一批并推送站点。 */
export async function runForgeWrite(): Promise<WriteBatchResult> {
  const limit = Number(process.env.FORGE_WRITE_LIMIT ?? "50");
  return writeBatch({ limit: Number.isInteger(limit) && limit >= 1 ? limit : 50 });
}
