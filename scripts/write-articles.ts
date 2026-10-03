// CLI 薄封装（批次 HS10-F1 模块化后）：逻辑在 packages/backend/src/editorial/write.ts。
// 手动跑批仍可用；worker 定时链路（forge.write）走 runForgeWrite。
import { parseArgs } from "node:util";
import { writeBatch } from "@aihot/backend/editorial/write";
import { closeDb } from "@aihot/backend/db";

const { values } = parseArgs({
  options: {
    limit: { type: "string", default: "20" },
    "min-date": { type: "string", default: "2025-01-01" },
    out: { type: "string", default: "" }, // 空则不落 JSONL（自动推送已配置时无需手工导入）
    genre: { type: "string", default: "auto" },
  },
});

const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error(`--limit 须为 1..500，收到 ${values.limit}`);
if (values.genre !== "auto" && values.genre !== "news" && values.genre !== "deepdive") throw new Error(`--genre 仅支持 news|deepdive|auto`);
if (values.out && !/^[\w./:\\-]+$/.test(values.out)) throw new Error(`--out 路径形态非法`);

const result = await writeBatch({
  limit,
  minDate: values["min-date"],
  genre: values.genre,
  jsonlPath: values.out || null,
});

console.log(`done: candidates=${result.candidates} written=${result.written} rejected=${result.rejected} pushed=${result.pushed}`);
for (const t of result.titles) console.log(`OK ${t.slug} ${t.title}`);
await closeDb();
