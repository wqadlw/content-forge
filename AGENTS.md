# AGENTS.md · Content Forge Agent 开发说明

> 找真空的后台内容车间：15 信源 → AI 四道闸成稿 → 自动推送到找真空网站。
> **Agent 会话开始前必读 `.ai/00-MAP.md`（项目地图）+ `.ai/01-DEV-STANDARD.md`（标准流程）+ `.ai/02-STATE.md`（当前状态）+ `.ai/03-LESSONS.md`（历史教训）。**

## 这是什么项目

Content Forge（正名 zzk-forge）= 接入任意 LLM API 的行业资讯自动化车间。定时抓取信源 → AI 筛选/聚簇/成稿 → 自动推送到找真空网站。本仓从 AIHOT 开源框架衍生（MIT），已无头化（无前端），管理面在运营中枢（zhaozhenkong-ops-console）。

## Agent 开发标准流程（六步，不可跳过）

```
① 调研 → ② 摸码 → ③ 出方案档 → ④ 实施+测试+构建 → ⑤ 端到端实测验收 → ⑥ 提交+留痕
```

详见 `.ai/01-DEV-STANDARD.md`。违反任何一步 = 后面必然返工（已验证）。

## 最常见任务

### 信源接入
见 `.ai/01-DEV-STANDARD.md` 第二节。核心：先四协议探测可达性 → 反爬挂起不硬闯 → allowUrlPrefixes 按解析后绝对路径写 → 国内 .com 配 egressRoute=direct。

### 成稿器改动
改提示词（industry/prompts/style-*.md）不碰代码；改质量门逻辑改 write.ts。两者改后必须跑一次手动成稿验证输出。

### 质量门调整
字数/禁词/元话语阈值要有数据支撑。新增检查项必须配套测试用例（正例+反例）。

### 排障
见 `.ai/04-WORKFLOW.md` 事故处理表。常见根因：
- 成稿 0 → 查台账 reject_reason + sources.last_error
- 新信源 0 素材 → 查 allowUrlPrefixes 匹配 + egressRoute
- 接收端 401 → SITE_IMPORT_TOKEN 不匹配

## 要守住的规则

1. **成稿纪律**：素材里没有的事实不写——编造是内容车间的死刑
2. **跑题不花 token**：相关性门在成稿调用之前，off-topic 直接进台账
3. **pin 不豁免质检**：编辑点名改变排队顺序，不跳过质量门
4. **文档与事实同步**：改了配置/流程/结构必须同步更新 `.ai/02-STATE.md`
5. **新坑当场沉淀**：`.ai/03-LESSONS.md`——先查后加，不重复踩
6. **公开仓纯净**：`industry/` 中的找真空定制与 `.ai/` 治理文档不进公开仓
7. **测试协议**：改代码后跑 `npx tsc --noEmit -p packages/backend`（0 错） + `node --test tests/*.test.ts`（存量绿）
8. **瞬时故障勿改码**：health=degraded 但手跑成功 = 瞬时故障，等健康度自动恢复

## 与其他仓的关系

| 仓 | 关系 |
|---|---|
| zhaozhenkong-oxalpha | 接收端（:8001），internal-api/v1/content/import 接收车间成品 |
| zhaozhenkong-ops-console | 运营中枢（:8002），内容车间五屏管理 |
| b2b-rfq-copilot | AI 采购引擎（:8000），知识库同步（暂断） |

## 本仓公开（github.com/wqadlw/content-forge）

- `.ai/` 被 gitignore——**禁止 `git add -f .ai`**（治理文档含私有信息）
- `industry/` 已替换为中性科技资讯示例包——找真空真实包在本地生产环境
- `.env` 被 gitignore——全部密钥走环境变量
- 上游 AIHOT（MIT）README 留档为 `README-AIHOT-upstream.md`
