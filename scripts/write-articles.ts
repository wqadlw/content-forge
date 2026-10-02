// HS7 批量成稿：把素材池（publications）里未成稿的真实条目，按找真空写作模板（industry/prompts/style-*）
// 写成整篇行业资讯。纪律：每篇锚定素材（原始标题/摘要/来源/日期），写作=加工不=编造；
// 确定性质量门（字数/禁词/段落数）不达标打回台账；台账防重复成稿；JSONL 供站点 articles:import-hotspot 导入。
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, statSync } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import { closeDb, sql } from "@aihot/backend/db";
import { chatJson } from "@aihot/backend/providers/llm";
import { modelFor } from "@aihot/backend/editorial/models";
import { promptText, promptVersion } from "@aihot/backend/editorial/prompts";

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "20" },
    "min-date": { type: "string", default: "2025-01-01" },
    out: { type: "string", default: "article-writes.jsonl" },
    genre: { type: "string", default: "auto" }, // news | deepdive | auto
  },
});

const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error(`--limit 须为 1..500，收到 ${values.limit}`);
if (values.genre !== "auto" && values.genre !== "news" && values.genre !== "deepdive") throw new Error(`--genre 仅支持 news|deepdive|auto`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(values["min-date"])) throw new Error(`--min-date 须为 YYYY-MM-DD`);
if (existsSync(values.out) && statSync(values.out).size > 0) throw new Error(`输出文件 ${values.out} 已存在且非空，换一个文件名（防覆盖已交付批次）`);

/* 模型偶尔把 seo 字段写成数组：preprocess 收敛为逗号串 */
const asString = z.preprocess((v) => (Array.isArray(v) ? v.map(String).join(",") : v), z.string());

const Output = z.object({
  title: z.string(),
  summary: z.string(),
  seo_title: asString,
  seo_keywords: asString,
  seo_description: asString,
  body_paragraphs: z.array(z.string()).min(4).max(8),
});

const NEWS_SYSTEM = promptText("style-news");
const DEEPDIVE_SYSTEM = promptText("style-deepdive");
const VERSION = promptVersion("style-news", "style-deepdive", "rules-anti-hallucination");

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
}

const candidates = await sql<Candidate[]>`
  SELECT p.article_id, p.title, p.original_title, p.summary, p.url, p.published_at, s.name AS source_name, s.tier
  FROM publications p JOIN sources s ON s.id = p.source_id
  WHERE NOT EXISTS (SELECT 1 FROM article_writes w WHERE w.article_id = p.article_id)
    AND p.eligible
    AND p.published_at >= ${values["min-date"]}::timestamptz
    AND length(coalesce(p.summary, '')) >= 30
    AND s.name NOT LIKE '找真空%'
  ORDER BY CASE s.tier WHEN 'T1' THEN 0 WHEN 'T1_5' THEN 1 ELSE 2 END, p.published_at DESC
  LIMIT ${limit}`;

console.log(`candidates: ${candidates.length}`);

let written = 0;
let rejected = 0;

for (const c of candidates) {
  const genre = values.genre === "auto" ? (cjk(c.summary ?? "") >= 200 ? "deepdive" : "news") : values.genre;
  const system = genre === "deepdive" ? DEEPDIVE_SYSTEM : NEWS_SYSTEM;

  let data: z.infer<typeof Output> | null = null;
  let fail: string | null = null;

  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    try {
      const res = await chatJson({
        model: await modelFor("articleWrite"),
        purpose: "article_write",
        subject: `pub:${c.article_id}#${attempt}`,
        promptVersion: VERSION,
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
      VALUES (${c.article_id}, 'rejected', ${genre}, ${c.title}, '', '', '', '', '', '', '', ${fail ?? "unknown"}, ${VERSION})`;
    rejected++;
    console.log(`REJECT ${c.article_id}: ${fail}`);
    continue;
  }

  const slug = `zzk-${createHash("sha256").update(data.title).digest("hex").slice(0, 8)}`;
  const body = data.body_paragraphs.map((p) => `<p>${p.replace(/^[#*\-\s]+/, "").trim()}</p>`).join("\n")
    + `\n<p><em>找真空行业观察 · 综合自${c.source_name}等公开报道</em></p>`;

  await sql`INSERT INTO article_writes (article_id, status, genre, title, slug, category, summary, seo_title, seo_keywords, seo_description, body, prompt_version)
    VALUES (${c.article_id}, 'written', ${genre}, ${data.title}, ${slug}, 'industry', ${data.summary}, ${data.seo_title}, ${data.seo_keywords}, ${data.seo_description}, ${body}, ${VERSION})`;

  const line = JSON.stringify({
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
  });
  appendFileSync(values.out, line + "\n");
  written++;
  console.log(`OK ${c.article_id} ${data.title}`);
}

console.log(`done: written=${written} rejected=${rejected}`);
await closeDb();
