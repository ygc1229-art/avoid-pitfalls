# 腾讯云生产部署方案

## 推荐拓扑

第一版使用一台腾讯云 CVM 运行网站容器和 HTTPS 入口，数据放在同地域、同 VPC 的腾讯云 PostgreSQL。数据库不开放公网访问。

```text
用户
  │ HTTPS 443
  ▼
CVM：Caddy（自动 HTTPS）
  │ 私有容器网络
  ▼
Next.js 网站
  │ VPC 私网 5432
  ▼
腾讯云 PostgreSQL（自动备份 / 高可用按购买规格）
```

Vercel 在腾讯云迁移验证完成前保留，作为回滚地址。不要在同一台 CVM 上用 Docker PostgreSQL 保存正式用户数据，除非已经接受单机故障和自行备份恢复的风险。

## 购买前必须决定

1. **访问区域**：首版面向香港及海外，可选香港地域，免中国大陆 ICP 备案；面向中国大陆公开运营，应选大陆地域并先完成 ICP 备案。
2. **域名**：准备一个由项目控制的域名。大陆备案还要求域名实名信息等材料。
3. **预算与可用性**：首版建议从 2 核 4 GB Ubuntu LTS CVM 起步；正式数据优先选择托管 PostgreSQL，而不是同机数据库。

## 腾讯云资源清单

- CVM：2 vCPU、4 GB 内存、Ubuntu LTS、系统盘 50 GB 起；
- 固定公网 IPv4；
- TencentDB for PostgreSQL：与 CVM 同地域、同 VPC；
- 安全组：公网仅开放 TCP 80、443；SSH 22 只允许管理员固定 IP；
- 数据库安全组：5432 仅允许 CVM 的私网安全组或私网 IP；
- DNS：域名 A 记录指向 CVM 公网 IP；
- 可选：对象存储 COS，用于未来私有证据文件；不要把证据放在网站容器磁盘。

## 服务器初始化

安装 Docker Engine 与 Compose 插件，创建部署目录，例如 `/opt/avoid-pitfalls`，只放以下三个文件：

- `deploy/compose.prod.yml`
- `deploy/Caddyfile`
- 由 `deploy/.env.production.example` 复制出的 `.env`

`.env` 权限应只允许管理员读取。真实数据库密码、会话密钥和管理员密码不得提交到 GitHub。

## 首次发布

GitHub 的 `Publish container` 工作流会在 `main` 更新后发布两个容器：

- `ghcr.io/ygc1229-art/avoid-pitfalls:<提交 SHA>`：网站；
- `ghcr.io/ygc1229-art/avoid-pitfalls:migrate-<提交 SHA>`：数据库迁移和种子。

在服务器部署目录中，将 `.env` 的 `APP_VERSION` 固定为本次 Git 提交 SHA，然后执行：

```bash
docker compose -f compose.prod.yml --profile tools pull
docker compose -f compose.prod.yml --profile tools run --rm migrate
docker compose -f compose.prod.yml pull web caddy
docker compose -f compose.prod.yml up -d web caddy
```

只有迁移成功后才更新网站。不要把 `latest` 当作长期生产版本；固定 SHA 才能可靠回滚。

## 发布验证

发布后至少确认：

- `/api/health` 返回 `status: ok` 且数据库模式为 PostgreSQL；
- 首页、搜索、筛选、详情和登录页均能打开；
- 匿名收藏、评论和投稿会要求登录；
- 手机宽度无横向溢出；
- HTTPS 证书有效，HTTP 自动跳转 HTTPS；
- 数据库没有公网入口；
- 腾讯云备份策略已开启，并完成过一次恢复演练。

## 回滚

把 `.env` 中 `APP_VERSION` 改回上一个已验证的 Git SHA，再拉取并重启 `web`。数据库迁移必须保持向后兼容；涉及不可逆结构变更时，需要单独的备份和回滚方案。

## 仍需补齐的生产能力

- 监控、错误告警和可用性探测；
- 数据库恢复演练与备份留存策略；
- Redis 或数据库级分布式限流；
- 管理员双因素认证和后台审核工作台；
- 私有证据对象存储、恶意文件扫描和脱敏流程；
- 隐私政策、用户协议、内容授权、举报和申诉机制。
