// 可选模块。找真空轻量版（批次 HS6a）：两项均为 AI 行业专属，找真空场景全部关闭——
// 导航入口/定时任务/API 路由/sitemap 全链自动摘除（worker 启动时自动 unschedule 残留 cron）。
// 二期代码级瘦身（删 leaderboard/monitor 目录与依赖）见 .ai/research-archive/33C。

export const FEATURES = {
  /** 模型榜：汇总公开评测，按公开方法计算共识排名。AI 行业专属，找真空关闭。 */
  leaderboard: false,
  /** Codex 重置监控：盯 X 上额度重置公告。AI 行业专属且需 SocialData 付费 key，关闭。 */
  codexResetMonitor: false,
} as const;
