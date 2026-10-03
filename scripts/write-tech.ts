// CLI 薄封装（批次 F4）：技术文档线手动跑批；worker 定时链路走 runForgeTechWrite。
import { parseArgs } from "node:util";
import { writeTechBatch, type TechKind } from "@aihot/backend/editorial/write";
import { closeDb } from "@aihot/backend/db";

const { values } = parseArgs({
  options: {
    kind: { type: "string", default: "guide" }, // guide | repair | wiki
    limit: { type: "string", default: "1" },
  },
});

if (values.kind !== "guide" && values.kind !== "repair" && values.kind !== "wiki") {
  throw new Error(`--kind 仅支持 guide|repair|wiki`);
}
const limit = Number(values.limit);
if (!Number.isInteger(limit) || limit < 1 || limit > 12) throw new Error(`--limit 须为 1..12`);

const result = await writeTechBatch({ kind: values.kind as TechKind, limit });
console.log(`done: candidates=${result.candidates} written=${result.written} rejected=${result.rejected} pushed=${result.pushed}`);
for (const t of result.titles) console.log(`OK ${t.slug} ${t.title}`);
await closeDb();
