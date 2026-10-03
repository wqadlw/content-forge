// 行业分类体系（示例包：科技资讯）：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉模型怎么归类。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 */
export const CATEGORIES = [
  { key: "product-launch", label: "新品发布", section: "新品发布/更新", guide: "硬件、软件、云服务、AI 模型与开发者工具等新产品的发布与版本更新" },
  { key: "price-market", label: "价格行情", section: "价格与行情", guide: "硬件与云服务价格波动、芯片与元器件行情、软件订阅价格变化" },
  { key: "tech-repair", label: "技术与维修", section: "技术与维修", guide: "工具选型、系统运维、故障诊断、性能调优（云/端/数据链路）、基准与压力测试" },
  { key: "industry", label: "行业动态", section: "行业动态", guide: "厂商经营、扩产、并购合作、人事变动、市场数据与科技产业链消息" },
  { key: "policy-standard", label: "政策标准", section: "政策与标准", guide: "数据与AI相关法规、出口管制、开源协议与合规、行业安全标准" },
  { key: "expo-show", label: "展会活动", section: "展会与活动", guide: "科技行业展会（如 CES/云栖大会）、行业会议、厂商开放日、线上研讨会" },
] as const;

/**
 * 内容理解一步给每篇资料判的“内容类型”（写在 prompts/content-understanding.md 里，改了类型要同步改那份提示词）。
 * 评分提示词（prompts/selection-score.md）按类型给五个维度不同的权重。
 */
export const ITEM_TYPES = ["product_launch", "price_market", "tech_repair", "industry_event", "policy_standard", "expo_activity"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = [
  "新品发布", "价格行情", "技术/维修", "选型/实践", "行业动态", "政策/标准", "展会/活动", "中标/招投标", "其他",
] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = [
  "AI 模型", "云计算", "开发者工具", "芯片", "数据库", "网络安全", "开源", "SaaS", "硬件", "物联网",
] as const;

/** 可选的实体标签（公司、机构、平台）。 */
export const ENTITY_TAGS = ["OpenAI", "Anthropic", "Google", "Microsoft", "Meta", "AWS", "NVIDIA", "Vercel", "GitHub", "示例公司"] as const;

/** 模型常写的近义词，统一成词表里的写法。 */
export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  大语言模型: "AI 模型", 大模型: "AI 模型", 生成式AI: "AI 模型", LLM: "AI 模型", 人工智能: "AI 模型",
  云主机: "云计算", IaaS: "云计算", PaaS: "云计算", 数据中心: "云计算",
  新品: "新品发布", 发布: "新品发布", 价格: "价格行情", 行情: "价格行情", 涨价: "价格行情", 降价: "价格行情",
  维修: "技术/维修", 保养: "技术/维修", 故障: "技术/维修", 选型: "选型/实践", 技巧: "选型/实践", 指南: "选型/实践",
  政策: "政策/标准", 标准: "政策/标准", 国标: "政策/标准", 能效: "政策/标准", 展会: "展会/活动", 博览会: "展会/活动",
  中标: "中标/招投标", 招标: "中标/招投标", 并购: "行业动态", 融资: "行业动态", 扩产: "行业动态", 合作: "行业动态", 公司动态: "行业动态",
};

/** 模型漏了分类标签时，按内容类型补一个。 */
export const CATEGORY_BY_ITEM_TYPE: Readonly<Record<string, string>> = {
  product_launch: "新品发布", price_market: "价格行情", tech_repair: "技术/维修",
  industry_event: "行业动态", policy_standard: "政策/标准", expo_activity: "展会/活动",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/** 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[] }> = {
  openai: { name: "OpenAI", displayTag: "OpenAI", aliases: ["OpenAI", "ChatGPT"] },
  anthropic: { name: "Anthropic", displayTag: "Anthropic", aliases: ["Anthropic", "Claude"] },
  google: { name: "Google", displayTag: "Google", aliases: ["Google", "谷歌", "Gemini"] },
  microsoft: { name: "Microsoft 微软", displayTag: null, aliases: ["Microsoft", "微软", "Azure"] },
  nvidia: { name: "NVIDIA 英伟达", displayTag: null, aliases: ["NVIDIA", "英伟达"] },
  meta: { name: "Meta", displayTag: null, aliases: ["Meta", "Facebook"] },
  aws: { name: "AWS", displayTag: null, aliases: ["AWS", "Amazon Web Services", "亚马逊云"] },
  vercel: { name: "Vercel", displayTag: null, aliases: ["Vercel", "Next.js"] },
  "demo-company": { name: "示例公司", displayTag: "示例", aliases: ["示例公司"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "busch", name: "Busch 普旭", patterns: [/\bbusch\b|普旭/i] },
  { id: "leybold", name: "Leybold 莱宝", patterns: [/\bleybold\b|莱宝/i] },
  { id: "edwards", name: "Edwards 爱德华", patterns: [/\bedwards?\b|爱德华/i] },
  { id: "pfeiffer", name: "Pfeiffer 普发", patterns: [/pfeiffer|普发/i] },
  { id: "atlas-copco", name: "Atlas Copco", patterns: [/atlas\s?copco|阿特拉斯/i] },
  { id: "ingersoll", name: "英格索兰", patterns: [/ingersoll|英格索兰/i] },
  { id: "ulvac", name: "ULVAC 爱发科", patterns: [/ulvac|爱发科/i] },
  { id: "agilent", name: "Agilent 安捷伦", patterns: [/agilent|安捷伦|varian|瓦里安/i] },
  { id: "zhongkeyi", name: "中科仪", patterns: [/中科仪|中科科仪/i] },
  { id: "naura", name: "北方华创", patterns: [/北方华创|naura/i] },
  { id: "hanzhong", name: "汉钟精机", patterns: [/汉钟/i] },
  { id: "baosi", name: "鲍斯股份", patterns: [/鲍斯/i] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "openai", domains: ["openai.com"] },
  { entityId: "anthropic", domains: ["anthropic.com"] },
  { entityId: "google", domains: ["blog.google", "deepmind.google"] },
  { entityId: "microsoft", domains: ["microsoft.com", "azure.microsoft.com"] },
  { entityId: "nvidia", domains: ["nvidia.com"] },
  { entityId: "meta", domains: ["meta.com", "ai.meta.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
