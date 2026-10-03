# Content Forge

**接入任意大模型 API 的行业资讯自动化车间**：定时抓取信源 → AI 筛选、去重、成稿 → 自动发布到你的网站。

> 本项目从 [AIHOT](https://github.com/DIYgod) 开源框架衍生（MIT，原框架面向"行业热点站"，本项目将其收敛为面向内容生产的后台车间，并增加成稿/质检/推送管线），原 MIT 许可与作者署名保留（见 `README-AIHOT-upstream.md`）。

## 它做什么

```
信源（厂商官网/协会/行业媒体/公众号——任意可抓站点）
  ↓ 定时抓取（频率可调：2h~12h，每源独立）
素材池（标题/摘要/链接/发布时间）
  ↓ ① 预筛：是不是本行业的？（LLM 判定）
  ↓ ② 双评分：值不值得写？（两次独立 LLM 评分，门槛可调）
  ↓ ③ 聚簇去重：同一事件的多篇报道合并（embedding + 两次 LLM 归组复核）
  ↓ ④ 成稿：按你的文风模板写整篇文章（LLM，文风=纯 Markdown 模板文件）
  ↓ ⑤ 质检：字数 / 禁词 / 元话语 / 相关性 四重门，不达标自动打回重写
  ↓ ⑥ 推送：token 鉴权 POST 到你网站的接收端点
你的网站（WordPress / 自建 CMS / 静态站……）
```

**内置护栏**（区别于 demo 级项目的生产设计）：

- 选题相关性门——跑题素材不花成稿 token
- 事件聚簇去重——同一事件只写一篇
- 确定性质量门——字数/禁词/元话语一票否决，重写不过即入"已打回"台账
- LLM 台账记账——每次模型调用可审计（receipts）
- 月度预算门——token 花销超限自动熔断
- 人工抽检台——合格率统计，跑量提速的判据
- 全操作审计——后台动作不可变留痕

## 快速开始

```bash
git clone https://github.com/<you>/content-forge.git
cd content-forge
npm install -g pnpm@10
pnpm install --frozen-lockfile --registry=https://registry.npmjs.org

cp .env.example .env    # 填 LLM_API_KEY / 数据库连接 / SITE_IMPORT_* 推送目标
node --env-file=.env scripts/migrate.ts
node --env-file=.env scripts/seed.ts

pnpm --filter @aihot/api start      # API :8004
pnpm --filter @aihot/worker start   # Worker（全部定时任务）
```

要求：Node.js ≥ 24、PostgreSQL 17。

## 配置你的行业（改一个目录，零代码）

所有行业知识都在 `industry/` 目录——**换行业 = 重写这个目录**：

| 文件 | 作用 |
|---|---|
| `site.ts` | 车间身份（名称/品牌/爬虫 UA/MCP 前缀） |
| `sources.json` | 信源清单（rss / web_list / json_list 三种适配器 + 抓取频率） |
| `prompts/` | 全部 LLM 提示词（预筛/评分/聚簇/成稿文风/周报——纯 Markdown，改文风不碰代码） |
| `taxonomy.ts` | 行业分类与标签体系 |
| `features.ts` | 可选模块开关 |

`prompts/style-*.md` 是成稿文风模板（资讯体/深度报告体/技术文档/周报），纯 Markdown 编辑即生效。

## 定时任务（worker 内置）

| 任务 | 默认频率 | 说明 |
|---|---|---|
| 信源抓取 | 每分钟调度，按源间隔到期即抓 | 每源独立间隔（2h~12h 可配） |
| 素材预筛/评分 | 每 5 分钟 | LLM 判定 |
| 成稿推送 | 工作日 06:40（`FORGE_WRITE_LIMIT` 可调批量） | 成稿并 POST 到你的网站 |
| 技术文档（可选） | 每周三 06:30 | 长青内容线 |
| 周报（可选） | 每周一 07:30 | 聚合上周成稿，附站内收录清单（逐条链接校验） |

频率在 `apps/worker/src/schedules.ts` 一行可改。

## 推送到你的网站

车间把成品 POST 到 `SITE_IMPORT_BASE` 的接收端点：

- 端点：`POST /internal-api/v1/content/import`，头 `X-Internal-Token: <SITE_IMPORT_TOKEN>`
- 载荷：`{ "items": [{ title, slug, type, category, summary, body(HTML), seo_title, seo_keywords, seo_description, author, source, featured }] }`
- 幂等：按 slug 去重，重推安全
- `docs/` 内附 WordPress 与通用 CMS 接收端点的参考实现

## 项目结构

```
apps/api            Fastify API（后台管理 + 公开只读 + MCP）
apps/worker         定时任务与管线（pgboss 调度）
packages/backend    管线引擎（采集/评分/聚簇/成稿/质检/推送/台账/预算/审计）
packages/contracts  类型契约
industry/           你的行业包（站点身份/信源/文风/分类——换行业只改这里）
database/           PostgreSQL 迁移
scripts/            CLI（建表/种子/成稿/导入）
```

## 环境变量

全部密钥与私有端点走环境变量，仓库零硬编码——见 `.env.example` 注释。

## License

MIT。
