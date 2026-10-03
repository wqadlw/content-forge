// 站点身份和读者看得到的文案。换成你的行业时，先改这个文件。
// 网页和后端都读它；改完重新构建（docker compose up --build）即可生效。
// 域名不在这里：部署时用环境变量 SITE_URL 设置。
// 本文件为示例包（科技资讯行业）——换你的行业时替换全部文案与品牌。

export const SITE = {
  /** 站名：导航、页面标题、分享图、RSS、MCP、后台都用它。 */
  name: "Forge Tech Digest",
  /**
   * 行业词：拼进默认说法里，比如“AI 日报”“科技动态”。
   * 这里是“科技资讯”。
   */
  subject: "科技资讯",
  /** 首页的完整标题（浏览器标签、搜索结果）。 */
  homeTitle: "Forge Tech Digest — 科技资讯生产线",
  /** 一句话介绍：搜索引擎、分享卡片、RSS、llms.txt 会用。 */
  description: "Content Forge 示例行业包：定时盯住科技行业信源，用模型摘要、打分、聚簇、成稿，把成品自动供给你的网站。",
  /** 首页左上角和侧边栏下面的一行小字。 */
  tagline: "你的后台内容车间",
  /** 界面语言（HTML lang、og:locale）。 */
  locale: "zh-CN",
  /** 默认域名，只在没设置 SITE_URL 时使用。 */
  defaultUrl: "http://127.0.0.1:8003",
  /**
   * MCP 工具名的前缀（小写字母、数字、下划线），工具会叫 forge_get_latest、forge_search……
   * 已经有人接入后就不要再改。
   */
  mcpPrefix: "forge",
  /** 对外联系邮箱（选填）：使用规则、llms.txt、响应头里会写。 */
  contactEmail: null as string | null,
  /** 页脚的一行小字（选填）。 */
  footerNote: "由 Content Forge 驱动 · 示例行业包",
  /** 中国大陆网站的 ICP 备案号（选填），填了就显示在页脚并链接到工信部备案系统。 */
  icp: null as string | null,
  /** 结构化数据里的网站运营者（搜索引擎用）。 */
  organization: {
    name: "Forge Tech Digest",
    /** 创始人（选填）：{ name, url, description }。 */
    founder: null as null | { name: string; url?: string; description?: string },
  },
  /** 抓取信源时报上的名字（User-Agent 里用），不要冒用别的站。 */
  crawlerName: "ForgeDigestBot",
} as const;
