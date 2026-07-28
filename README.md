# 避坑指南

把前人的经验，留成看得见的路标。

避坑指南是一套可检索、可纠错、会过期的公共风险知识产品。访客无需注册即可浏览、搜索和筛选；注册后可以投稿、评论、收藏、提交反证或提醒内容已经过期。第一版聚焦租房、求职、教育留学、旅行和消费五个领域。

## 第一版已包含

- 匿名首页、搜索、组合筛选和帖子详情；
- 三种知识卡片：官方公开案例摘要、规则更新、行动清单；
- 50 条经过来源核查的金标准种子内容，不伪装成用户亲历；
- 邮箱密码注册、登录、登出和安全服务端会话；
- 投稿、评论、收藏、结构化纠错/反证/过期反馈；
- 投稿审核状态、管理员审核接口和审计记录；
- 积分、等级与贡献勋章；
- Zod 表单/API 校验、统一错误格式、同源检查和基础限流；
- PostgreSQL 数据库、迁移与幂等种子脚本；
- 响应式页面、键盘焦点、减少动态和可读性规则；
- Vitest、ESLint、TypeScript、生产构建检查；
- Docker Compose 与 GitHub Actions CI。

## 内容原则

本站不是曝光墙，也不收集没有行动价值的抱怨。

- 个案、公开案例、规则与编辑建议必须明确区分；
- 来源、适用地区、检查日期和风险边界必须可见；
- “否认”不会靠多数票直接判定帖子真假，而会进入结构化复核；
- AI 可以辅助分类和发现敏感信息，不能裁定事实、责任或违法；
- 原始合同、聊天、证件等证据不得直接公开；
- 已过期内容保留历史价值，但必须停止作为当前建议传播。

完整标准见：

- [`docs/PRODUCT_CONTRACT.md`](docs/PRODUCT_CONTRACT.md)
- [`docs/TEAM_PROMPTS.md`](docs/TEAM_PROMPTS.md)
- [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)
- [`docs/TRUST_AND_SAFETY.md`](docs/TRUST_AND_SAFETY.md)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)
- [`docs/OPERATIONS_TENCENT_CLOUD.md`](docs/OPERATIONS_TENCENT_CLOUD.md)

## 最快运行：完整本地版

需要安装 Docker Desktop。

```bash
cp .env.example .env
docker compose up --build
```

打开 <http://localhost:3000>。首次启动会建立数据库并导入 50 条种子内容。

如需创建第一位本地审核管理员，请同时设置 `.env` 的 `SEED_ADMIN_EMAIL` 与 `SEED_ADMIN_PASSWORD`。账号只会由种子命令创建，不会因为有人抢先注册某个邮箱而获得管理权限。正式生产环境仍应改为后台邀请和二次验证。

停止服务：

```bash
docker compose down
```

连同本地数据库一起删除（会丢失本地测试数据）：

```bash
docker compose down --volumes
```

## 本机开发

需要 Node.js 24、pnpm 11 和 PostgreSQL。

```bash
cp .env.example .env.local
pnpm install
pnpm db:setup
pnpm dev
```

没有配置 `DATABASE_URL` 时，公开浏览会自动降级到 50 条只读种子内容；注册、投稿、评论、收藏等写操作会明确返回“数据库未启用”，不会伪装保存成功。

## 检查

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

一次运行全部检查：

```bash
pnpm check
```

## 环境变量

以 [`.env.example`](.env.example) 为准。不要提交真实密钥。

邮箱密码在数据库和会话密钥可用时完整工作。Google、微信和手机号只完成了供应商状态契约与配置位，OAuth/短信回调尚未实现，因此即使填写密钥也仍会显示为不可用，不会伪装成已经接通。短信登录未来也禁止使用固定万能验证码。

## 主要页面

| 路径 | 权限 | 用途 |
|---|---|---|
| `/` | 匿名 | 首页、领域入口、精选路标 |
| `/search` | 匿名 | 搜索与组合筛选 |
| `/posts/[id]` | 匿名 | 帖子详情、来源、时效和反证入口 |
| `/login` | 匿名 | 注册与登录 |
| `/submit` | 登录 | 结构化投稿 |
| `/profile` | 登录 | 收藏、贡献、积分、等级与勋章 |

API 采用统一 JSON 错误格式；具体约定和端点见 [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)。

## 当前明确边界

- 第一版没有公开原始证据上传；数据库已为私有证据元数据和后续对象存储预留边界；
- Google、微信和短信登录需要各平台真实资质与密钥，仓库不包含这些凭据；
- 进程内限流只适合单实例第一版；多实例生产部署需要 Redis 或数据库限流；
- PostgreSQL 基础检索可以支撑首版，规模增长后可接专用中文搜索服务；
- 审核后台第一版以明确状态和接口为主，复杂队列、双人复核工作台和申诉工作台属于后续版本；
- 项目不提供法律、医疗或财务结论；高风险内容必须回到当地官方来源和专业人士。

## 数据真实性

`public/data/gold-samples.jsonl` 来自会议 1.4 的 50 条金标准索引，包含 76 个去重公开来源链接。种子内容统一标识为公开来源整理或编辑行动清单，不使用虚构第一人称，也不把 AI 生成文本包装成亲身经历。

## 许可证与贡献

项目目前未声明开源许可证，因此默认保留全部权利。提交内容或代码前，请先确认未来的贡献协议、内容授权和隐私条款。
