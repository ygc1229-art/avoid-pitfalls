# 避坑指南 V1 技术架构

> 状态：V1 开发基线
> 适用范围：Next.js 全栈应用、PostgreSQL、本地与容器化运行
> 核心原则：匿名可读，认证后写入；证据分级，个人信息最小化；所有外部能力必须可降级且不得伪装为已启用。

## 1. 产品与技术目标

“避坑指南”将个人经历转化为可检索、可纠错、会过期的公共风险知识。V1 应形成一条真实闭环：

1. 匿名用户无需登录即可浏览、搜索、筛选和阅读已发布内容。
2. 用户使用本地邮箱和密码注册、登录后，可以投稿、评论、收藏、纠错、反证和发起过期反馈。
3. 投稿经过结构化校验与审核状态流转后才能公开。
4. 帖子保留证据等级、适用地区、有效期、反证和修订历史，避免把个案包装成普遍事实。
5. 用户贡献产生积分、等级、勋章和通知，但激励不得奖励夸张、攻击或无证据曝光。
6. 系统能在单体架构中完成 V1，同时为搜索服务、对象存储、异步任务和第三方登录预留清晰接口。

### 1.1 非目标

V1 不承诺：

- 判断任何个人、机构或事件的法律责任；
- 自动证明用户陈述绝对真实；
- 在没有服务密钥时提供 Google、微信或短信登录；
- 公开原始身份证件、完整合同、聊天对象姓名、电话号码等敏感证据；
- 实时聊天、私信、支付、广告系统或原生 App；
- 用积分兑换现金或形成可交易资产；
- 依靠 AI 自动做出最终封禁、诽谤判定或高风险内容发布决定。

## 2. 总体架构

V1 采用模块化单体（modular monolith），以降低部署和调试成本，并保持未来拆分能力。

```text
浏览器
  |
  | HTTPS
  v
Next.js 应用
  ├─ Server Components：公开页面与服务端读取
  ├─ Route Handlers：/api/*
  ├─ Server Actions：仅用于同源表单，复用应用服务
  ├─ Auth 模块：会话、本地凭证、可配置身份适配器
  ├─ Content 模块：投稿、版本、证据、发布生命周期
  ├─ Discovery 模块：搜索、筛选、排序
  ├─ Community 模块：评论、收藏、纠错、反证、过期投票
  ├─ Trust & Safety 模块：审核、举报、风控、审计
  └─ Reputation 模块：积分、等级、勋章、通知
  |
  ├─ PostgreSQL：事务数据、全文检索、审计记录
  ├─ 本地文件适配器：仅开发环境的证据附件
  └─ 可选对象存储适配器：生产环境后续接入
```

### 2.1 推荐技术基线

- Next.js App Router + TypeScript；
- PostgreSQL 16 或兼容版本；
- `pg` 参数化查询；迁移采用仓库内版本化 SQL，避免 ORM 模型与数据库双重真相；
- 应用自有的短期会话模块：浏览器只持有随机令牌，数据库只保存 SHA-256 令牌摘要；
- Node.js `scrypt` 密码哈希（N=16384、r=8、p=1、随机 16 字节盐）；未来迁移 Argon2id 时必须支持旧哈希渐进升级；
- Zod 统一校验 API、表单和环境变量；
- PostgreSQL `tsvector` + `pg_trgm` 完成 V1 中文检索的基础能力；
- Redis 为可选增强项；V1 无 Redis 时，限流使用数据库或进程内开发适配器，并在多实例生产部署前强制切换为共享存储；
- Vitest 进行单元、校验和 PostgreSQL 兼容迁移测试；关键用户链路在真实浏览器中验收。

## 3. 代码边界

推荐目录：

```text
src/
  app/
    (public)/             # 首页、搜索、帖子详情
    (auth)/               # 注册、登录、找回密码
    (member)/             # 投稿、收藏、通知、个人页
    (staff)/              # 审核后台
    api/v1/               # 版本化 HTTP API
  modules/
    auth/
    users/
    taxonomy/
    posts/
    evidence/
    moderation/
    community/
    reputation/
    notifications/
    search/
  lib/
    db/
    storage/
    rate-limit/
    security/
    observability/
```

每个业务模块分为：

- `domain`：实体、状态机和不依赖框架的规则；
- `application`：用例、权限检查、事务边界；
- `infrastructure`：数据库、存储、邮件、OAuth 等适配器；
- `presentation`：Route Handler、Server Action、DTO。

页面和接口不得直接拼接数据库操作；所有写入必须经过应用服务，以保证权限、审核、积分和审计规则一致。

## 4. 身份认证与会话

### 4.1 V1 必须可用

本地邮箱/密码账号必须在没有任何第三方密钥时完整运行：

- 注册：邮箱标准化、小写去空格、唯一性检查、密码策略、同意条款；
- 登录：统一失败提示，避免枚举账号；
- 会话：`HttpOnly`、`Secure`（生产）、`SameSite=Lax` Cookie；
- 登出：撤销当前会话；
- 邮箱验证：开发环境可输出一次性验证链接到安全的本地日志或调试邮箱页面；生产环境必须配置邮件服务后才标记为“已验证”；
- 密码重置：使用一次性、短时效、数据库仅存哈希的令牌；
- 管理员不得读取密码或重置令牌明文。

### 4.2 可配置身份适配器

| 方式 | 默认状态 | 启用条件 | 无配置时的行为 |
|---|---|---|---|
| 邮箱/密码 | 启用 | 数据库与会话密钥 | 正常可用 |
| Google | 禁用 | Client ID、Client Secret、回调地址 | 登录页不展示或明确标注“暂未开放”，接口返回 `PROVIDER_DISABLED` |
| 微信 | 禁用 | 对应开放平台资质、App ID、Secret、回调地址 | 同上 |
| 手机号 | 禁用 | 短信供应商、签名模板、风控配置 | 同上；禁止使用固定万能验证码 |

所有身份方式统一写入 `IdentityAccount`，用户主记录不与某一家供应商耦合。账号绑定必须要求当前会话重新验证，防止登录态被利用后绑定攻击者账号。

## 5. 数据模型

所有主键建议使用 UUIDv7 或 ULID；时间统一存 UTC，界面按用户时区显示。业务表至少包含 `createdAt`、`updatedAt`；需要软删除的内容增加 `deletedAt`。公开接口使用不可推断的 ID。

### 5.1 用户与身份

#### User

- `id`
- `handle`：公开唯一用户名
- `displayName`
- `avatarUrl`
- `bio`
- `status`：`ACTIVE | LIMITED | SUSPENDED | DELETED`
- `role`：`USER | MODERATOR | ADMIN`
- `emailVisibility`：始终为私有，字段只表达内部策略
- `pointsBalance`：缓存值，真实依据为积分流水
- `levelId`
- `createdAt`、`updatedAt`、`deletedAt`

#### IdentityAccount

- `id`、`userId`
- `provider`：`CREDENTIALS | GOOGLE | WECHAT | PHONE`
- `providerSubject`：供应商侧稳定 ID；本地账号使用标准化邮箱
- `email`、`phone`：加密或受限访问
- `emailVerifiedAt`、`phoneVerifiedAt`
- `passwordHash`：仅 Credentials 使用
- `createdAt`、`lastUsedAt`

唯一约束：`(provider, providerSubject)`；Credentials 的标准化邮箱全局唯一。

#### Session / VerificationToken / PasswordResetToken

令牌只存哈希；包含到期时间、使用时间和必要的撤销字段。清理任务定期删除过期记录。

### 5.2 分类、标签与地区

#### Category

- `id`、`slug`、`name`
- `parentId`：支持二级分类
- `description`
- `status`
- `defaultExpiryDays`
- `sortOrder`

#### Tag

- `id`、`slug`、`name`
- `kind`：`SCENE | ISSUE | AUDIENCE | TIME | OTHER`
- `status`

#### PostTag

- `postId`、`tagId`
- `source`：`AUTHOR | MODERATOR | SYSTEM`

#### Region

- `id`
- `parentId`
- `code`：优先使用稳定行政区或 ISO 编码
- `name`
- `level`：`COUNTRY | PROVINCE | CITY | DISTRICT | CUSTOM`
- `centroid`：可选，V1 不依赖精确定位

#### PostRegion

- `postId`、`regionId`
- `scope`：`APPLIES_TO | OCCURRED_IN`

帖子可以无地区（普适知识），也可以关联多个地区。不得以用户精确住址作为地区标签。

### 5.3 帖子与版本

#### Post

- `id`、`authorId`
- `categoryId`
- `status`：见第 6 节
- `visibility`：V1 为 `PUBLIC | UNLISTED | PRIVATE`
- `riskLevel`：`LOW | MEDIUM | HIGH | CRITICAL`
- `evidenceLevel`：`NONE | CLAIMED | PARTIAL | VERIFIED`
- `currentRevisionId`
- `publishedAt`
- `validUntil`
- `lastReviewedAt`
- `disputedAt`
- `expiredAt`
- `searchVector`
- `viewCount`、`favoriteCount`、`commentCount`：可重建缓存
- `createdAt`、`updatedAt`、`deletedAt`

#### PostRevision

- `id`、`postId`
- `version`
- `title`
- `summary`：卡片级避坑结论
- `context`：发生条件
- `whatHappened`
- `warningSigns`
- `actionAdvice`
- `counterExampleNotes`
- `sourceType`：`FIRST_HAND | SECOND_HAND | PUBLIC_SOURCE | SYNTHETIC_SAMPLE`
- `changeReason`
- `createdBy`
- `createdAt`

已发布内容不得被原地覆盖；编辑创建新版本，通过审核后切换 `currentRevisionId`。模拟样本必须明确标为 `SYNTHETIC_SAMPLE`，不得伪装成亲身经历。

### 5.4 证据

#### Evidence

- `id`、`postId`、`revisionId`、`uploaderId`
- `type`：`IMAGE | DOCUMENT | CHAT_RECORD | RECEIPT | LINK | OTHER`
- `storageKey`：私有对象键，不存公开 URL
- `originalFileName`：仅后台可见，必要时加密
- `mimeType`、`sizeBytes`、`sha256`
- `redactionStatus`：`PENDING | PASSED | NEEDS_CHANGES | REJECTED`
- `verificationStatus`：`UNREVIEWED | CONSISTENT | INCONCLUSIVE | INCONSISTENT`
- `publicPreviewKey`：仅脱敏衍生文件
- `metadata`
- `createdAt`、`deletedAt`

原始证据默认私有，只允许作者和有权限的审核员通过短时签名 URL 查看。公开页面只能展示审核通过的脱敏预览。EXIF、地理位置、设备信息应在生成预览时移除。

### 5.5 审核与审计

#### ModerationEvent

- `id`
- `entityType`、`entityId`
- `actorId`：系统事件可空
- `fromStatus`、`toStatus`
- `reasonCode`
- `note`：内部备注与用户可见说明分离
- `metadata`
- `createdAt`

#### Report

- `id`
- `reporterId`：匿名举报可后续开放，V1 要求登录
- `targetType`、`targetId`
- `reasonCode`
- `details`
- `status`：`OPEN | TRIAGED | ACTIONED | REJECTED`
- `assigneeId`
- `createdAt`、`resolvedAt`

审核事件采用追加写，不允许普通后台操作删除；涉及管理员操作时必须记录操作者、原因、前后状态和关联请求 ID。

### 5.6 纠错、反证与过期

统一使用 `PostChallenge` 表达三类反馈：

- `type`：`CORRECTION | COUNTER_EVIDENCE | EXPIRY_VOTE`
- `postId`、`revisionId`
- `authorId`
- `claim`：结构化说明
- `evidenceId`：可选
- `vote`：过期反馈可为 `STILL_VALID | PARTLY_OUTDATED | OUTDATED`
- `status`：`PENDING | PUBLISHED | ACCEPTED | REJECTED | WITHDRAWN`
- `resolutionNote`
- `createdAt`、`resolvedAt`

过期不是简单多数票。系统综合 `validUntil`、分类默认周期、地区、可信用户反馈、反证和审核结果。高风险帖子到期后应先降权并标注“待复核”；确认失效后进入 `EXPIRED`，仍可访问历史内容和替代信息。

### 5.7 评论与收藏

#### Comment

- `id`、`postId`、`authorId`
- `parentId`：V1 最多两层
- `body`
- `status`：`VISIBLE | PENDING | HIDDEN | DELETED`
- `helpfulCount`
- `createdAt`、`updatedAt`、`deletedAt`

#### Favorite

- `userId`、`postId`
- `createdAt`

唯一约束：`(userId, postId)`。匿名用户可在浏览器暂存收藏意图，但服务端收藏必须登录；登录后可显式确认同步。

### 5.8 积分、等级、勋章与通知

#### PointLedger

- `id`、`userId`
- `delta`
- `reasonCode`
- `sourceType`、`sourceId`
- `idempotencyKey`
- `createdAt`

积分必须是不可变流水；`User.pointsBalance` 仅为缓存。撤销奖励通过反向流水完成。

#### Level

- `id`、`name`
- `minPoints`
- `iconKey`
- `benefits`：V1 只用于展示，不赋予审核权

#### Badge / UserBadge

`Badge` 定义名称、描述、图标、授予规则和状态；`UserBadge` 记录用户、勋章、授予原因、授予时间和可选撤销时间。

#### Notification

- `id`、`userId`
- `type`
- `title`、`body`
- `entityType`、`entityId`
- `readAt`
- `createdAt`

V1 为站内通知。邮件、推送通知通过适配器后续接入。

## 6. 帖子生命周期

```text
DRAFT
  -> SUBMITTED
  -> UNDER_REVIEW
  -> NEEDS_CHANGES -> DRAFT
  -> APPROVED
  -> PUBLISHED
       -> DISPUTED -> PUBLISHED / NEEDS_CHANGES / ARCHIVED
       -> REVIEW_DUE -> PUBLISHED / EXPIRED
       -> EXPIRED -> PUBLISHED（重新验证）
       -> ARCHIVED
  -> REJECTED
```

关键约束：

- 只有作者可编辑自己的 `DRAFT` 和 `NEEDS_CHANGES`；
- 提交后，作者不能修改当前待审版本，只能撤回或等待结果；
- 发布、驳回、隐藏、确认过期必须产生 `ModerationEvent`；
- 重大修订需要重新审核；
- `CRITICAL` 风险、点名指控、可能造成现实伤害或包含敏感证据的内容必须人工审核；
- 自动系统只能预筛选、去重、脱敏提示和风险排序，不得直接发布高风险内容；
- 被质疑不等于自动下架；系统先展示争议标识，紧急安全或隐私风险除外。

## 7. 权限矩阵

| 操作 | 匿名 | 登录用户 | 内容作者 | 审核员 | 管理员 |
|---|---:|---:|---:|---:|---:|
| 浏览已发布帖子 | 是 | 是 | 是 | 是 | 是 |
| 搜索与筛选 | 是 | 是 | 是 | 是 | 是 |
| 查看公开脱敏证据 | 是 | 是 | 是 | 是 | 是 |
| 查看原始证据 | 否 | 否 | 自己上传的 | 按任务授权 | 按职责授权 |
| 创建草稿/投稿 | 否 | 是 | 是 | 是 | 是 |
| 编辑帖子 | 否 | 否 | 自己可编辑状态 | 审核修订建议 | 是 |
| 评论/收藏 | 否 | 是 | 是 | 是 | 是 |
| 纠错/反证/过期反馈 | 否 | 是 | 是 | 是 | 是 |
| 举报 | V1 否 | 是 | 是 | 是 | 是 |
| 审核普通内容 | 否 | 否 | 否 | 是 | 是 |
| 审核自己的内容 | 否 | 否 | 否 | 否 | 仅紧急处置且审计 |
| 调整分类和标签 | 否 | 否 | 否 | 建议 | 是 |
| 封禁用户/分配角色 | 否 | 否 | 否 | 否 | 是 |
| 查看安全审计记录 | 否 | 否 | 否 | 限相关案件 | 是 |

权限必须在服务端逐项验证；隐藏按钮不是安全控制。管理员操作要求近期重新认证，重要操作建议启用双因素认证。

## 8. 搜索、索引与排序

### 8.1 V1 搜索方案

使用 PostgreSQL 完成结构化筛选和基础全文检索：

- `PostRevision` 的标题、摘要、预警信号和行动建议生成加权 `tsvector`；
- 中文内容默认启用 `pg_trgm`，支持相似词和部分匹配；
- 精确筛选：分类、标签、地区、风险等级、证据等级、内容来源、状态、发布时间和有效性；
- 只索引 `PUBLISHED`、`DISPUTED`、`REVIEW_DUE` 和可公开的 `EXPIRED`；
- 查询先执行可见性条件，再计算文本相关度，禁止先返回结果后在应用层过滤。

建议排序因子：

```text
score =
  文本相关度
  × 新鲜度衰减
  × 证据权重
  × 内容完整度
  × 有帮助反馈
  × 地区匹配度
  × 状态降权
```

积分或作者等级不得直接决定事实可信度。争议、待复核和已过期内容应明显标识并降权，但在用户主动筛选时仍可检索。

### 8.2 索引建议

- `User(handle)` 唯一索引；
- `IdentityAccount(provider, providerSubject)` 唯一索引；
- `Category(slug)`、`Tag(slug)`、`Region(code)` 唯一或条件唯一索引；
- `Post(status, publishedAt DESC)`；
- `Post(categoryId, status, publishedAt DESC)`；
- `Post(riskLevel, status, publishedAt DESC)`；
- `Post(validUntil)` 条件索引，覆盖待复核任务；
- `PostRevision(postId, version)` 唯一索引；
- `GIN(searchVector)`；
- 标题和摘要的 `GIN/GiST gin_trgm_ops`；
- `PostTag(tagId, postId)` 与 `PostRegion(regionId, postId)`；
- `Comment(postId, status, createdAt)`；
- `Favorite(userId, createdAt DESC)` 与 `(userId, postId)` 唯一索引；
- `PostChallenge(postId, type, status, createdAt)`；
- `ModerationEvent(entityType, entityId, createdAt)`；
- `Notification(userId, readAt, createdAt DESC)`；
- `PointLedger(userId, createdAt)` 与 `idempotencyKey` 唯一索引。

上线后使用真实慢查询数据验证索引，不为低基数字段盲目建立单列索引。

### 8.3 演进边界

当数据规模、语言分词或排序需求超过 PostgreSQL 能力时，将 `SearchRepository` 替换为 OpenSearch/Meilisearch 等服务。数据库仍是真实来源，搜索索引只保存公开、脱敏、可重建数据；通过事务外盒（outbox）同步，不能在业务事务中双写。

## 9. 附件与对象存储

定义统一接口：

```ts
interface ObjectStorage {
  createUploadIntent(input: UploadIntent): Promise<UploadTarget>;
  head(key: string): Promise<ObjectMetadata>;
  createPrivateDownloadUrl(key: string, ttlSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}
```

适配器：

- `LocalStorageAdapter`：仅本地开发，把文件保存到应用数据目录；文件目录不得提交 Git；
- `S3CompatibleStorageAdapter`：后续生产接入 S3、R2 或兼容服务；
- 未配置生产对象存储时，证据上传功能必须明确禁用，不能把本地磁盘伪装成可靠生产存储。

上传流程：申请上传意图 → 校验大小和 MIME → 上传到隔离区 → 计算哈希/扫描恶意文件 → 脱敏 → 审核 → 生成公开预览。禁止直接信任扩展名，禁止公开原始对象键。

## 10. 事务、异步任务与一致性

必须处于同一数据库事务的操作：

- 发布帖子、写入审核事件、创建作者积分流水；
- 收藏创建/删除与计数更新；
- 评论创建与通知事件；
- 接受纠错、创建修订和状态变化；
- 发放勋章与授予记录。

邮件、缩略图、内容扫描、搜索同步、统计聚合和通知分发通过 `OutboxEvent` 异步执行。V1 可使用定时任务轮询 PostgreSQL；任务必须可重试且具有幂等键。不得依靠请求结束后的未等待 Promise。

## 11. 威胁模型

### 11.1 保护资产

- 账号、会话、密码哈希和重置令牌；
- 未公开投稿和原始证据；
- 邮箱、手机号、聊天记录、合同等个人信息；
- 审核结论、内部备注和管理员身份；
- 内容完整性、积分与勋章公平性；
- 服务可用性和搜索结果可信度。

### 11.2 主要威胁与控制

| 威胁 | 典型方式 | V1 控制 |
|---|---|---|
| 凭证撞库 | 批量尝试邮箱密码 | scrypt、登录限流、统一错误、异常检测、可选验证码 |
| 账号枚举 | 注册/找回提示不同 | 对外使用统一响应；内部审计真实结果 |
| 会话劫持 | XSS、Cookie 泄漏 | HttpOnly/Secure/SameSite、CSP、会话轮换、输出转义 |
| CSRF | 诱导已登录用户写入 | SameSite、Origin 校验、CSRF Token（非同源场景） |
| 越权访问 | 修改 ID 读取私有证据 | 每次服务端对象级授权，签名 URL 短时有效 |
| 存储型 XSS | 帖子/评论插入脚本 | 默认纯文本或白名单 Markdown，服务端清洗，禁止任意 HTML |
| SQL 注入 | 恶意查询参数 | ORM 参数化查询，禁止字符串拼 SQL |
| SSRF | 证据链接或抓取器访问内网 | V1 不自动抓取任意 URL；后续使用域名/IP 校验和隔离网络 |
| 恶意文件 | 伪装图片、病毒、压缩炸弹 | MIME 魔数、大小限制、隔离区、扫描、重新编码预览 |
| 隐私泄露 | 公开合同、EXIF、手机号 | 默认私有、脱敏审核、元数据移除、访问审计 |
| 诽谤与人肉 | 点名攻击个人/机构 | 结构化准入、证据分级、敏感实体审核、申诉与纠错 |
| 批量灌水 | 机器人投稿、评论、投票 | 分端点限流、账号年龄/信誉阈值、重复检测、审核队列 |
| 协同操纵 | 群体过期投票或刷收藏 | 唯一票约束、行为风控、投票不直接决定状态 |
| 积分作弊 | 重复动作获得积分 | 不可变流水、幂等键、每日上限、撤销流水 |
| 管理员滥用 | 私查证据、改状态 | 最小权限、不可删审计、敏感操作重认证、职责分离 |
| 供应链攻击 | 恶意依赖或 CI 密钥泄漏 | 锁文件、依赖审计、最小 CI 权限、密钥不进仓库 |
| 拒绝服务 | 高成本搜索、上传轰炸 | 分页上限、查询超时、上传配额、限流、缓存 |

### 11.3 内容安全原则

- 内容审核与事实核验是两个不同结论；
- “证据一致”只表示材料与陈述相符，不代表司法认证；
- 对可能造成重大现实损害的指控，默认更严格而不是更高传播；
- 用户删除账号后，依法和按产品政策处理个人信息；为维护公共知识而保留的匿名内容必须解除与用户身份的可逆关联；
- 安全日志不得记录密码、令牌、完整证据内容或不必要的个人信息。

## 12. 限流、滥用防护与配额

建议按 `IP + accountId + route group` 组合限流：

- 搜索：匿名 60 次/分钟，登录用户 120 次/分钟；
- 登录：每 IP 10 次/10 分钟，每账号 5 次/10 分钟，阶梯退避；
- 注册/找回密码：每 IP 5 次/小时；
- 投稿提交：普通账号 10 次/天；
- 评论：20 次/10 分钟；
- 收藏：60 次/分钟；
- 纠错/反证/过期反馈：20 次/天；
- 上传意图：20 次/小时，并限制单文件与用户总容量。

数值是初始安全基线，需依据监控调整。开发环境可使用内存实现；任何多实例或公开生产部署必须使用共享限流存储。

## 13. 可观测性与运维

- 每个请求生成 `requestId`，返回给客户端并写入结构化日志；
- 记录 API 路由、状态码、耗时、匿名化主体 ID，不记录正文和敏感凭证；
- 关键指标：错误率、P95 延迟、登录失败率、投稿审核积压、搜索零结果率、举报处理时间、过期复核积压；
- 对审核、权限、身份绑定和原始证据访问建立安全审计；
- PostgreSQL 自动备份，并定期验证恢复流程；
- 数据库迁移采用向前兼容的 expand/migrate/contract；
- 健康检查区分存活与就绪，数据库异常时不得假装健康。

## 14. 环境配置与失败策略

启动时用 Zod 校验环境变量：

- 必需：`DATABASE_URL`、`AUTH_SECRET`、`APP_URL`；
- 本地邮件：`EMAIL_MODE=console`；
- Google、微信、短信、对象存储分别以独立 `*_ENABLED` 和密钥配置启用；
- 如果 `*_ENABLED=true` 但配置不完整，应用启动失败；
- 如果配置缺失且未启用，界面隐藏对应能力，API 返回稳定的禁用错误；
- 禁止使用默认生产密钥，禁止把 `.env` 提交版本库。

## 15. 可演进边界

通过接口隔离以下变化：

- `IdentityProvider`：增加或替换登录供应商；
- `ObjectStorage`：本地文件切换到 S3 兼容服务；
- `SearchRepository`：PostgreSQL 切换到专用搜索引擎；
- `RateLimiter`：内存/数据库切换到 Redis；
- `NotificationChannel`：站内扩展到邮件、短信和推送；
- `ModerationClassifier`：规则引擎扩展到 AI 辅助，但最终权限仍在审核工作流；
- `JobQueue`：数据库 Outbox 扩展到消息队列。

拆分微服务的触发条件应是独立扩缩容、隔离故障、团队边界或明确性能瓶颈，而不是预先设计。用户、内容和审核的核心事务在 V1 保持同库。

## 16. V1 完成标准

- 未登录用户可浏览、搜索、筛选和阅读公开帖子；
- 邮箱/密码注册、登录、登出和会话保护可在本地运行；
- 第三方登录无密钥时明确禁用；
- 投稿、审核、修订、发布、纠错、反证和过期流程具有可审计状态；
- 评论、收藏、积分、等级、勋章和通知使用真实 PostgreSQL 数据；
- 原始证据默认私有，公开内容经过脱敏；
- 所有写接口实施身份、对象权限、校验、限流和统一错误；
- 数据库迁移、种子数据、测试、Docker 和 CI 可重复执行；
- README 明确区分已完成、需配置和后续功能。
