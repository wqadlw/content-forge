// CLI 薄封装（批次 F5）：周报线手动出刊兜底；worker 定时链路走 writeWeeklyReport（每周一 07:30）。
import { writeWeeklyReport } from "@aihot/backend/editorial/write";
import { closeDb } from "@aihot/backend/db";

const result = await writeWeeklyReport();
console.log(`done: candidates=${result.candidates} written=${result.written} rejected=${result.rejected} pushed=${result.pushed}`);
for (const t of result.titles) console.log(`OK ${t.slug} ${t.title}`);
await closeDb();
