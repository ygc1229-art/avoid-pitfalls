# 避坑指南 V1 API 契约

> V1 实现基础路径：`/api`。接口字段保持版本化契约；出现不兼容升级时再引入 `/api/v2`。
> 数据格式：`application/json; charset=utf-8`
> 时间格式：ISO 8601 UTC，例如 `2026-07-28T08:30:00.000Z`
> ID：不可推断的字符串 ID（UUIDv7/ULID）
> 原则：所有读取默认匿名可用；所有用户写入要求登录；审核和管理接口要求角色授权。

> 实现说明：当前代码已实现认证、帖子列表/详情、评论、收藏、结构化反馈、健康检查和管理员帖子审核。本文其余端点是已冻结的后续契约，不应被理解为仓库中已经存在的功能。

## 1. 通用约定

### 1.1 成功响应

单项：

```json
{
  "data": {
    "id": "01J..."
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

列表：

```json
{
  "data": [],
  "meta": {
    "requestId": "req_01J...",
    "nextCursor": "opaque_cursor_or_null",
    "hasMore": false
  }
}
```

创建成功返回 `201`；删除成功优先返回 `204`；异步受理返回 `202`。

### 1.2 错误格式

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "提交内容有误，请检查后重试。",
    "fieldErrors": {
      "title": ["标题需为 8–80 个字符。"]
    },
    "details": null
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

对外 `message` 不包含堆栈、SQL、供应商错误或敏感状态。`details` 只放安全、结构化且有助于客户端恢复的信息。

### 1.3 稳定错误码

| HTTP | code | 含义 |
|---:|---|---|
| 400 | `BAD_REQUEST` | 请求无法解析 |
| 400 | `VALIDATION_ERROR` | 字段校验失败 |
| 401 | `AUTH_REQUIRED` | 未登录或会话失效 |
| 401 | `INVALID_CREDENTIALS` | 登录失败；不区分账号是否存在 |
| 403 | `FORBIDDEN` | 已登录但无权操作 |
| 403 | `ACCOUNT_LIMITED` | 账号受限 |
| 404 | `NOT_FOUND` | 资源不存在或当前用户不可见 |
| 409 | `CONFLICT` | 状态冲突、重复提交 |
| 409 | `EMAIL_ALREADY_USED` | 注册邮箱已使用；仅在不会扩大枚举风险的注册上下文返回 |
| 409 | `VERSION_CONFLICT` | 乐观锁版本不一致 |
| 410 | `RESOURCE_GONE` | 资源已永久撤下 |
| 413 | `PAYLOAD_TOO_LARGE` | 正文或附件过大 |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | 文件类型不支持 |
| 422 | `INVALID_STATE_TRANSITION` | 不允许的状态变化 |
| 429 | `RATE_LIMITED` | 请求过于频繁 |
| 503 | `PROVIDER_DISABLED` | 外部身份、邮件、短信或存储适配器未启用 |
| 503 | `SERVICE_UNAVAILABLE` | 临时依赖故障 |
| 500 | `INTERNAL_ERROR` | 未预期服务错误 |

限流响应包含 `Retry-After`。冲突响应可在 `details.currentVersion` 返回当前资源版本，但不得泄露私有数据。

### 1.4 认证与 CSRF

- 浏览器使用安全会话 Cookie，不把会话令牌放入 `localStorage`；
- 所有写接口要求有效会话；
- 同源请求检查 `Origin`；框架不能充分保护时增加 CSRF Token；
- 审核员和管理员敏感操作要求近期重新认证；
- API 不接受客户端传入 `userId` 作为操作主体，主体始终来自会话。

### 1.5 分页、排序与筛选

- 列表使用不透明游标，不使用大偏移分页；
- `limit` 默认 20，最大 50；
- 游标绑定查询、排序与最后一条记录，客户端不得解释；
- 默认排序必须稳定，最后以 `id` 作为并列条件；
- 未识别的筛选项返回 `VALIDATION_ERROR`，避免静默忽略导致误解。

### 1.6 乐观并发

可编辑资源响应带 `version`。更新时客户端提交：

```http
If-Match: "7"
```

版本不一致返回 `409 VERSION_CONFLICT`。帖子审核状态变化、修订和评论编辑必须使用乐观锁。

### 1.7 幂等

以下创建接口接受：

```http
Idempotency-Key: 8f4c...（客户端生成，最多 128 字符）
```

适用：注册、提交投稿、创建评论、收藏写入、创建纠错/反证、上传意图、审核决定。服务端按 `主体 + 路由 + key` 保存请求摘要和响应至少 24 小时：

- 相同键、相同请求：返回首次结果；
- 相同键、不同请求：返回 `409 CONFLICT`；
- 积分流水和异步任务必须继续使用内部幂等键，不能只依赖 HTTP 层。

## 2. 公开读取 API

### 2.1 首页聚合

`GET /home`

查询参数：

- `region`：可选地区代码；
- `limit`：每个区块数量，默认 8，最大 12。

返回热门、最新、临近过期和高风险精选区块。只包含公开状态和脱敏字段。

### 2.2 搜索帖子

`GET /posts`

查询参数：

- `q`：关键词，0–100 字符；
- `category`：分类 slug；
- `tags`：逗号分隔标签 slug，最多 10 个；
- `region`：地区 code；
- `riskLevel`：`LOW | MEDIUM | HIGH | CRITICAL`，可多选；
- `evidenceLevel`：`NONE | CLAIMED | PARTIAL | VERIFIED`；
- `sourceType`：`FIRST_HAND | SECOND_HAND | PUBLIC_SOURCE | SYNTHETIC_SAMPLE`；
- `validity`：`CURRENT | REVIEW_DUE | DISPUTED | EXPIRED`；
- `sort`：`RELEVANCE | NEWEST | MOST_HELPFUL | EXPIRING_SOON`；
- `cursor`、`limit`。

匿名可用。返回卡片 DTO：

```json
{
  "id": "01J...",
  "slug": "rent-hidden-fee-01J...",
  "title": "签约前未确认管理费，入住后每月多支出",
  "summary": "把所有固定费用写入合同附件，并确认计费周期。",
  "category": {
    "slug": "renting",
    "name": "租房"
  },
  "tags": [
    { "slug": "hidden-fees", "name": "隐藏费用" }
  ],
  "regions": [
    { "code": "CN-SH", "name": "上海" }
  ],
  "riskLevel": "MEDIUM",
  "evidenceLevel": "PARTIAL",
  "sourceType": "FIRST_HAND",
  "statusLabel": "有效",
  "publishedAt": "2026-07-20T09:00:00.000Z",
  "validUntil": "2027-01-20T09:00:00.000Z",
  "favoriteCount": 31,
  "commentCount": 8
}
```

不得返回作者邮箱、原始证据键、内部审核原因、未发布修订或精确位置。

### 2.3 帖子详情

`GET /posts/{postIdOrSlug}`

匿名可用。返回：

- 当前公开修订；
- 分类、标签、地区；
- 风险和证据等级的解释文本；
- 公开脱敏证据预览；
- 状态、有效期和最近复核时间；
- 已发布的纠错、反证摘要和处理结果；
- 评论首屏；
- 作者公开资料摘要；
- 当前登录用户的 `viewerState`，匿名时为 `null`。

`EXPIRED` 内容可访问，但响应必须包含 `validityWarning` 和替代内容链接。`PRIVATE`、草稿和用户无权查看的资源统一返回 404。

### 2.4 分类、标签和地区

- `GET /categories`
- `GET /categories/{slug}`
- `GET /tags?kind=&q=&limit=`
- `GET /regions?q=&parent=&level=&limit=`

均匿名可用。分类返回默认过期周期的用户友好说明，但不暴露内部风控规则。

### 2.5 评论读取

`GET /posts/{postId}/comments?sort=HELPFUL|NEWEST&cursor=&limit=`

仅返回 `VISIBLE` 评论、公开作者信息和最多两层回复。已删除评论可返回占位，不返回正文。

### 2.6 公开用户资料

`GET /users/{handle}`

返回展示名、头像、简介、等级、公开勋章、已发布帖子统计。不得返回邮箱、手机号、登录方式、处罚和未公开贡献。

## 3. 身份 API

身份 API 由 V1 自有会话模块承载；对产品层保持以下稳定行为。

### 3.1 查询可用登录方式

`GET /auth/providers`

匿名可用：

```json
{
  "data": [
    { "id": "credentials", "label": "邮箱", "enabled": true },
    { "id": "google", "label": "Google", "enabled": false },
    { "id": "wechat", "label": "微信", "enabled": false },
    { "id": "phone", "label": "手机号", "enabled": false }
  ],
  "meta": {
    "requestId": "req_01J..."
  }
}
```

客户端必须依据此响应展示登录入口。未配置供应商不得显示为可用。

### 3.2 注册

`POST /auth/register`

```json
{
  "email": "user@example.com",
  "password": "a-strong-password",
  "displayName": "新用户",
  "acceptedTermsVersion": "2026-07"
}
```

要求：

- 邮箱标准化；
- 密码 10–128 字符，并拒绝常见泄漏密码；
- 显示名 2–30 字符；
- 必须接受当前条款；
- 接受 `Idempotency-Key`；
- 成功返回 `201`，可直接建立会话或要求验证后登录，行为由环境策略决定但必须在响应中明确。

### 3.3 登录、登出与当前用户

- `POST /auth/login`：`{ "email", "password" }`
- `POST /auth/logout`
- `GET /auth/me`

登录失败统一返回 `401 INVALID_CREDENTIALS`。`GET /auth/me` 未登录返回 `data: null`，用于页面恢复，不将正常匿名状态作为错误。

### 3.4 邮箱验证与密码重置

- `POST /auth/email-verification/request`
- `POST /auth/email-verification/confirm`
- `POST /auth/password-reset/request`
- `POST /auth/password-reset/confirm`

请求接口始终返回中性成功信息，防止账号枚举。令牌单次使用、短时有效，数据库只存哈希。

### 3.5 外部身份

- `GET /auth/{provider}/start`
- `GET /auth/{provider}/callback`
- `POST /auth/phone/request-code`
- `POST /auth/phone/verify`

`provider` 仅允许配置白名单。未启用时返回 `503 PROVIDER_DISABLED`，不得回退到假 OAuth 页面或万能短信验证码。

## 4. 帖子写入 API

### 4.1 创建草稿

`POST /posts`

认证：登录用户。

```json
{
  "categoryId": "01J...",
  "riskLevel": "MEDIUM",
  "sourceType": "FIRST_HAND",
  "title": "签约前未确认管理费，入住后每月多支出",
  "summary": "把所有固定费用写入合同附件，并确认计费周期。",
  "context": "通过中介租住公寓，签约时只确认了租金。",
  "whatHappened": "入住后收到额外管理费账单。",
  "warningSigns": ["费用口径只在聊天中出现", "合同没有总费用表"],
  "actionAdvice": ["要求列出全部固定和一次性费用", "将确认结果写入合同附件"],
  "tagIds": ["01J..."],
  "regionIds": ["01J..."],
  "validUntil": "2027-01-20T09:00:00.000Z"
}
```

创建为 `DRAFT`，返回资源和 `version`。第一人称内容不等于已验证；`sourceType` 必须真实标注。

### 4.2 查看自己的帖子

- `GET /me/posts?status=&cursor=&limit=`
- `GET /me/posts/{postId}`

返回作者可见的草稿、待审版本、审核反馈和证据状态。禁止通过公开详情接口泄露这些字段。

### 4.3 修改草稿

`PATCH /posts/{postId}`

认证：作者；仅 `DRAFT` 或 `NEEDS_CHANGES`。要求 `If-Match`。请求字段与创建接口一致，采用部分更新。修改已发布内容时创建新修订，而非覆盖公开版本。

### 4.4 提交、撤回和修订

- `POST /posts/{postId}/submit`
- `POST /posts/{postId}/withdraw`
- `POST /posts/{postId}/revisions`

提交前校验：

- 必填结构完整；
- 分类、标签、地区有效；
- 风险与有效期合理；
- 证据若声明存在，必须完成上传且通过基础安全检查；
- 无未脱敏的明显个人信息；
- 接受 `Idempotency-Key`。

提交成功状态为 `SUBMITTED` 或 `UNDER_REVIEW`，返回 `202`。撤回不删除审核历史。

### 4.5 删除

`DELETE /posts/{postId}`

作者只能删除未发布草稿；已发布内容使用撤回/匿名化申请流程：

`POST /posts/{postId}/removal-requests`

系统必须区分作者不再公开署名、内容隐私风险和公共记录保留，不在 API 中承诺即时物理删除。

## 5. 证据 API

### 5.1 创建上传意图

`POST /posts/{postId}/evidence/upload-intents`

认证：作者；接受幂等键。

```json
{
  "fileName": "contract-redacted.pdf",
  "mimeType": "application/pdf",
  "sizeBytes": 482010,
  "sha256": "hex-encoded-sha256",
  "evidenceType": "DOCUMENT"
}
```

返回：

```json
{
  "data": {
    "evidenceId": "01J...",
    "upload": {
      "method": "PUT",
      "url": "short-lived-url-or-local-endpoint",
      "headers": {},
      "expiresAt": "2026-07-28T08:40:00.000Z"
    }
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

若当前环境没有可用存储适配器，返回 `503 PROVIDER_DISABLED`。

### 5.2 完成上传

`POST /evidence/{evidenceId}/complete`

服务端重新检查对象大小、MIME 和哈希，再进入扫描/脱敏队列。不得相信客户端完成声明。

### 5.3 查询与删除证据

- `GET /posts/{postId}/evidence`：作者查看自己的证据状态；
- `DELETE /evidence/{evidenceId}`：仅未进入不可撤销审核阶段时允许；
- `GET /evidence/{evidenceId}/private-url`：作者或有任务权限审核员获取短时访问地址；
- 公开预览只通过帖子详情 DTO 返回，不提供可枚举的原始下载接口。

## 6. 社区 API

### 6.1 评论

- `POST /posts/{postId}/comments`
- `PATCH /comments/{commentId}`
- `DELETE /comments/{commentId}`
- `POST /comments/{commentId}/helpful`
- `DELETE /comments/{commentId}/helpful`

创建请求：

```json
{
  "body": "补充：部分公寓会把管理费按季度收取，最好确认周期。",
  "parentId": null
}
```

正文 2–1000 字符，默认纯文本或受限 Markdown。只有作者可编辑自己的可见评论；审核隐藏后不可自行恢复。

### 6.2 收藏

- `PUT /posts/{postId}/favorite`
- `DELETE /posts/{postId}/favorite`
- `GET /me/favorites?cursor=&limit=`

`PUT` 天然幂等：重复调用返回当前收藏状态，不重复增加积分或计数。匿名客户端可本地保存意图，但不能调用服务端写入。

### 6.3 纠错、反证和过期反馈

`POST /posts/{postId}/challenges`

```json
{
  "type": "EXPIRY_VOTE",
  "revisionId": "01J...",
  "claim": "该收费规则在 2026 年 6 月已经调整。",
  "vote": "OUTDATED",
  "evidenceId": "01J..."
}
```

规则：

- `CORRECTION`：指出可核对的事实或表达错误；
- `COUNTER_EVIDENCE`：提交与原结论不一致的证据；
- `EXPIRY_VOTE`：`STILL_VALID | PARTLY_OUTDATED | OUTDATED`；
- 同一用户对同一修订的有效过期票只保留一票，新票覆盖旧票并留审计；
- 投票不直接改变帖子状态；
- 接受幂等键，返回 `201` 或 `202`。

读取：

- `GET /posts/{postId}/challenges?type=&status=&cursor=`
- 公开用户只看到 `PUBLISHED` 或已形成正式处理结果的内容。

### 6.4 举报

`POST /reports`

```json
{
  "targetType": "POST",
  "targetId": "01J...",
  "reasonCode": "PERSONAL_DATA",
  "details": "截图中仍可看到完整手机号。"
}
```

登录必需；严重隐私和现实安全风险进入高优先级队列。举报结果只向举报者返回有限状态，不公开内部处置细节。

## 7. 用户、积分、等级、勋章与通知 API

### 7.1 我的资料

- `GET /me/profile`
- `PATCH /me/profile`
- `POST /me/avatar/upload-intent`
- `DELETE /me/account`：创建账号删除请求，不保证同步物理删除。

公开用户名变更需限频并保留旧链接重定向策略。邮箱和手机号不通过个人资料接口修改，必须走身份验证流程。

### 7.2 积分与等级

- `GET /me/reputation`
- `GET /me/points?cursor=&limit=`
- `GET /levels`

积分只可由服务端规则产生，客户端不得提交 `delta`。响应应同时给出余额、下一等级门槛及积分流水的用户友好原因。

### 7.3 勋章

- `GET /badges`
- `GET /me/badges`
- `PATCH /me/badges/{badgeId}`：仅控制是否在公开资料展示。

用户不能自行授予勋章。撤销勋章保留审计记录。

### 7.4 通知

- `GET /me/notifications?unreadOnly=&cursor=&limit=`
- `POST /me/notifications/{notificationId}/read`
- `POST /me/notifications/read-all`

通知创建由业务事件触发。读取其他用户通知必须返回 404，而非 403，以减少资源枚举。

## 8. 审核后台 API

前缀：`/moderation`。认证：`MODERATOR` 或 `ADMIN`。所有写操作记录 `requestId`、操作者、原因和前后状态。

### 8.1 审核队列

`GET /moderation/queue`

筛选：

- `entityType`、`status`、`riskLevel`、`category`；
- `hasEvidence`、`containsSensitiveEntity`；
- `assignee`、`submittedBefore`；
- `sort=RISK|OLDEST|NEWEST`。

返回内部 DTO，但个人信息字段仍按任务最小化展示。

### 8.2 认领和释放

- `POST /moderation/items/{entityType}/{entityId}/claim`
- `POST /moderation/items/{entityType}/{entityId}/release`

认领使用租约而非永久锁；超时自动释放。管理员不得默认绕过他人认领直接覆盖决定。

### 8.3 帖子审核决定

`POST /moderation/posts/{postId}/decisions`

```json
{
  "decision": "NEEDS_CHANGES",
  "reasonCodes": ["PERSONAL_DATA_NOT_REDACTED", "ADVICE_TOO_GENERAL"],
  "authorMessage": "请遮挡合同中的姓名和联系方式，并补充费用发生的时间。",
  "internalNote": "原始附件暂未发现伪造迹象。",
  "expectedVersion": 3
}
```

`decision`：

- `APPROVE`
- `NEEDS_CHANGES`
- `REJECT`
- `HIDE_PENDING_REVIEW`
- `MARK_DISPUTED`
- `CONFIRM_EXPIRED`
- `RESTORE`
- `ARCHIVE`

要求：

- 接受幂等键；
- 使用乐观锁；
- 审核员不能审核自己的内容；
- `CRITICAL` 内容、紧急隐藏后的永久处置和管理员相关内容建议双人复核；
- 用户可见说明与内部备注分开保存。

### 8.4 证据审核

`POST /moderation/evidence/{evidenceId}/decisions`

```json
{
  "redactionStatus": "NEEDS_CHANGES",
  "verificationStatus": "INCONCLUSIVE",
  "reasonCodes": ["PHONE_VISIBLE"],
  "authorMessage": "请遮挡截图右上角的手机号。"
}
```

“材料一致”不等于事实或法律结论。公开接口不得展示审核员身份和内部备注。

### 8.5 纠错、反证、过期与举报处理

- `POST /moderation/challenges/{challengeId}/decisions`
- `POST /moderation/reports/{reportId}/decisions`
- `GET /moderation/audit?entityType=&entityId=&actorId=&cursor=`

接受纠错时应关联新修订或明确状态变化。确认过期时必须记录依据、适用地区和复核时间，不能只写“票数足够”。

## 9. 管理 API

前缀：`/admin`，仅 `ADMIN`，敏感操作要求近期重新认证。

- `POST /admin/categories`
- `PATCH /admin/categories/{categoryId}`
- `POST /admin/tags`
- `PATCH /admin/tags/{tagId}`
- `POST /admin/regions`
- `PATCH /admin/regions/{regionId}`
- `PATCH /admin/users/{userId}/status`
- `PATCH /admin/users/{userId}/role`
- `POST /admin/badges`
- `PATCH /admin/badges/{badgeId}`

角色变更、封禁、解封和分类过期规则调整必须要求原因，写入不可删除审计事件。普通后台界面不得提供修改积分余额的直接输入框；积分修正使用带原因的反向/补偿流水端点。

## 10. 字段校验基线

| 字段 | 规则 |
|---|---|
| 标题 | 8–80 字符，去首尾空格 |
| 摘要 | 15–160 字符，必须包含可执行结论 |
| 发生背景 | 10–1000 字符 |
| 发生经过 | 20–3000 字符 |
| 预警信号 | 1–8 项，每项 4–120 字符 |
| 行动建议 | 1–8 项，每项 4–160 字符 |
| 评论 | 2–1000 字符 |
| 纠错说明 | 10–2000 字符 |
| 标签 | 每帖最多 10 个 |
| 地区 | 每帖最多 5 个 |
| 附件 | 默认单文件 10 MB；PDF 可配置至 20 MB |
| 分页 | 默认 20，最大 50 |

字符限制按 Unicode 字素或清晰记录的服务端规则计算，前后端共享同一 schema。所有枚举采用白名单，URL 必须限制协议为 HTTPS（本地开发例外）。

## 11. 缓存契约

- 公开分类、标签和地区：可缓存 5–30 分钟；
- 公开帖子详情：短缓存并使用内容版本作为 ETag；
- 搜索结果：初期不缓存或按规范化查询短缓存；
- `/auth/me`、`/me/*`、审核和管理接口：`Cache-Control: private, no-store`；
- 状态变更、发布、纠错接受和确认过期后必须失效相关公开缓存；
- 私有响应不得进入共享 CDN。

## 12. 限流响应与客户端行为

`429` 示例：

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "操作过于频繁，请稍后再试。",
    "fieldErrors": null,
    "details": {
      "retryAfterSeconds": 42
    }
  },
  "meta": {
    "requestId": "req_01J..."
  }
}
```

客户端应禁用重复提交并在可恢复时倒计时；不得自动快速重试写操作。服务端限流基线：

- 匿名搜索：60/分钟/IP；
- 登录：10/10 分钟/IP 且 5/10 分钟/账号；
- 投稿：10/天/用户；
- 评论：20/10 分钟/用户；
- 纠错、反证和过期反馈：20/天/用户；
- 上传意图：20/小时/用户。

限流不替代业务幂等和唯一约束。

## 13. Webhook 与异步事件边界

V1 不对公众开放 Webhook。内部 Outbox 事件至少包括：

- `post.submitted`
- `post.published`
- `post.review_due`
- `post.expired`
- `challenge.created`
- `challenge.accepted`
- `comment.created`
- `evidence.uploaded`
- `evidence.redaction_required`
- `points.awarded`
- `badge.awarded`
- `notification.created`

事件包含 `eventId`、`type`、`occurredAt`、`entityId`、`schemaVersion`，不包含原始证据、密码、令牌和不必要的个人信息。消费者按 `eventId` 幂等处理。

## 14. 版本与演进策略

- V1 路径前缀为 `/api`；不兼容升级必须新开版本路径；
- 新增可选字段属于兼容变更；
- 删除/改名字段、改变枚举语义和权限属于破坏性变更；
- 客户端必须忽略未知响应字段，但不能忽略未知状态；
- 枚举扩展前确认客户端有安全兜底；
- 专用搜索服务、对象存储、消息队列和新增登录供应商只能替换内部适配器，不改变核心资源语义；
- 公开帖子 DTO 与内部数据库模型分离，防止架构调整导致隐私字段意外外泄；
- API 文档最终应从共享 schema 生成 OpenAPI，并在 CI 校验破坏性变化。

## 15. V1 API 验收清单

- 匿名请求可以完成首页、搜索、筛选、帖子详情、分类和评论读取；
- 匿名请求对任何服务端写接口均得到 `401 AUTH_REQUIRED`；
- 本地邮箱/密码注册登录无需第三方服务；
- Google、微信、手机号未配置时由 providers 接口明确返回禁用，直接调用返回 `PROVIDER_DISABLED`；
- 作者只能修改自己的可编辑状态内容；
- 审核员不能审核自己的帖子；
- 私有证据无法通过公开 ID 枚举；
- 收藏、评论、投稿、积分和审核决定具备幂等或唯一约束；
- 过期投票不会直接改变帖子状态；
- 所有错误都包含稳定错误码和 `requestId`；
- 所有列表有最大分页限制；
- 所有敏感响应使用 `no-store`；
- API 集成测试覆盖认证、对象级权限、状态机、重复请求和限流。
