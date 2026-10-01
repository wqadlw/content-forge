// 站点身份和读者看得到的文案。换成你的行业时，先改这个文件。
// 网页和后端都读它；改完重新构建（docker compose up --build）即可生效。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "找真空热点",
  /**
   * 行业词：拼进默认说法里，比如“AI 日报”“AI 动态”。
   * 这里是“真空行业”。
   */
  subject: "真空行业",
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: "找真空热点 — 真空行业动态 · 每日精选与日报",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: "自动盯住真空行业的厂商新闻、行业媒体与找真空站内动态，用模型摘要、打分、精选，把同一件事的多篇报道归到一起，每天早上出一份行业日报。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "值得关注的真空行业动态",
  /** 界面语言（HTML lang、og:locale）。 */
  locale: "zh-CN",
  /** 默认域名，只在没设置 SITE_URL 时使用。 */
  defaultUrl: "http://127.0.0.1:8003",
  /**
   * MCP 工具名的前缀（小写字母、数字、下划线），工具会叫 zzkhot_get_latest、zzkhot_search……
   * 已经有人接入后就不要再改。
   */
  mcpPrefix: "zzkhot",
  /** 对外联系邮箱（选填）：使用规则、llms.txt、响应头里会写。 */
  contactEmail: null as string | null,
  /** 页脚的一行小字（选填）。 */
  footerNote: "找真空旗下行业热点站 · 由 AIHOT 开源框架驱动",
  /** 中国大陆网站的 ICP 备案号（选填），填了就显示在页脚并链接到工信部备案系统。 */
  icp: null as string | null,
  /** 结构化数据里的网站运营者（搜索引擎用）。 */
  organization: {
    name: "找真空热点",
    /** 创始人（选填）：{ name, url, description }。 */
    founder: null as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用），不要冒用别的站。 */
  crawlerName: "ZZKHotBot",
} as const;

/** 关于页的文案。数字（信源数、收录数、精选数、日报期数）来自站内实时统计，不用写在这里。 */
export const ABOUT = {
  kicker: `关于 ${SITE.name}`,
  /** 大标题：第一行正常颜色，第二行强调色。 */
  headline: ["真空行业每天都有新动静，", "值得看的，只有几条。"] as [string, string],
  /** 标题下面的一段话。{sources} 会换成实时的信源数。 */
  lead: `${SITE.name} 替你盯着 {sources} 个信源：抓取、归并、打分、精选，每天早上 8 点出一份真空行业日报。由找真空运营，免费，不用注册。`,
  /** 信源河动画下面的四个环节。 */
  steps: {
    collect: "真空设备厂商官方新闻、行业媒体、找真空站内动态都在看；活跃的源 15 分钟就看一次。",
    store: "抓到的都存下来，同一件事的报道归到一起；只计入热度的账号也算在内，热点榜就是从这里算出来的。",
    select: "模型先看是不是真空行业的事、有没有实际信息，再写中文标题、摘要和推荐理由；营销稿和重复转发进不来。",
    publish: "每天 08:00 出真空行业日报，周一出周报，每月 1 日出月报；精选内容同步供找真空网站引用。",
  },
  /**
   * 作者块（选填），null 就不显示。
   */
  maker: null as null | {
    name: string;
    greeting: string[];
    avatarSourceId?: string | null;
    wechat?: { title: string; note: string };
    feishu?: { title: string; note: string };
  },
  /** 页面底部的版权与下架说明（结尾会接“反馈页”的链接）。 */
  copyright: `${SITE.name} 是聚合摘要和阅读索引，原文版权归各来源所有。如果你是来源方，希望更正、下架或调整展示方式，可以通过`,
} as const;

/** “真空行业日报”这类说法：行业词和名词之间，英文词加空格，中文词不加。 */
export function withSubject(noun: string): string {
  return /[A-Za-z0-9]$/.test(SITE.subject) ? `${SITE.subject} ${noun}` : `${SITE.subject}${noun}`;
}
