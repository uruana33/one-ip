<img src="public/icon.svg" alt="Logo" width="96" height="96" />

# IP 网络工具

<p align="left">
  <img src="https://img.shields.io/badge/React-19-282C34?logo=react&amp;logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&amp;logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&amp;logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&amp;logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Lucide-F56565?logo=lucide&amp;logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Jotai-000000" alt="Jotai" />
  <img src="https://img.shields.io/badge/TanStack_Query-FF4154?logo=reactquery&amp;logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&amp;logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&amp;logoColor=white" alt="pnpm 10" />
  <img src="https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&amp;logoColor=black" alt="Prettier" />
</p>

IP 查询、网络诊断与 AI 服务状态工具箱。

**中文** · [English](README.en.md)

[GitHub](https://github.com/uruana33/one-ip)

社区友链：[LINUX DO](https://linux.do/) · 真诚、友善、团结、专业。

点击下方按钮，一键部署到 Cloudflare。

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Furuana33%2Fone-ip)

## Cloudflare 部署教程

1. [Fork 本项目](https://github.com/uruana33/one-ip/fork)到你的 GitHub 账号。
2. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages**，创建 Worker，选择导入 Git 仓库。
3. 连接 GitHub，选择你的 `one-ip` Fork，生产分支填 `main`。
4. 构建命令填 `pnpm build`，部署命令填 `pnpm run deploy`。使用 Node.js 24 和 pnpm 10.32.1，根目录保持默认。
5. 点击部署，完成后打开 `workers.dev` 地址。自定义域名在 Worker 设置中绑定。

项目使用 **Cloudflare Workers + Static Assets**，`/api/*` 接口需要 Worker。基础功能无需应用环境变量或 API Key。

IP 质量页的可选增强（不配置时对应来源保持"去原站"外链，不会报读取失败）：

| 变量                 | 作用                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `IPQS_API_KEY`       | 配置后自动读取 IPQualityScore 欺诈分 / 匿名旗标 / 用途                                    |
| `ABUSEIPDB_API_KEY`  | 配置后自动读取 AbuseIPDB 滥用置信度 / 举报数 / 用途                                       |
| `IPREGISTRY_API_KEY` | 配置后用账号 key 查 IPregistry；未配置时回退站点公开 demo key（全局限流，可能偶发不可用） |

在 Worker 的 Settings → Variables and Secrets 中添加（Secret 类型）即可，无需改动代码。

Workers Builds 会在 `main` 收到提交时构建和部署。上方按钮指向本仓库；需要自己的部署时，请按教程导入你的 Fork。

## 功能

| 模块      | 支持的功能                                                                                          |
| --------- | --------------------------------------------------------------------------------------------------- |
| 首页概览  | 国内与外部 IPv4 探测、归属地、运营商、信誉分与类型标签                                              |
| IP 详情   | IPv4 / IPv6 查询、ASN、CIDR、注册信息、网络属性、风险标记、多源位置对比与关联地址；字段取决于数据源 |
| 出口观测  | 检查不同网站的出口 IP，按地址汇总分流；DNS 出口与 CDN 节点                                          |
| 全球 Ping | Globalping 全球探针、地区与城市选择、延迟与丢包、分批返回结果                                       |
| DNS / CDN | DNS 解析出口、CDN 命中节点及可读取的缓存信息                                                        |
| WHOIS     | 域名、IP、ASN 的 RDAP 注册资料与原始响应                                                            |
| AI 访问   | ChatGPT、Claude、Grok、Perplexity、Gemini、DeepSeek、通义千问、Kimi 的资源连通性与部分平台出口对照  |
| 服务状态  | 聚合官方运行状态、故障、维护、组件与事件详情                                                        |
| 使用体验  | 中英文、深浅主题、移动端布局与底部抽屉、查询历史、二维码分享与复制链接                              |

第三方服务的限流和跨域限制会影响查询结果。HTTP 耗时与 ICMP Ping 的测量方式不同。IP 类型和信誉分供参考，不代表 AI 平台的官方判断。

## 终端与 API

部署此版本后，可通过 `GET /api/ip/health` 查询 IP 健康度，无需 API Key。

```bash
# 指定公网 IPv4，终端文本（本地 Worker 必须带 ip）
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=1.1.1.1&format=text'

# 默认返回 JSON，便于脚本处理
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=1.1.1.1'

# IPv6
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=2606:4700:4700::1111&format=text'
```

部署后把主机名换成你的域名。线上可省略 `ip`，接口会使用 Cloudflare 识别的本次请求出口；经过代理时会查询代理出口。

返回 `ip`、`source`、`checked_at`、`score`、`status`、位置、ISP、ASN 和 `flags`（住宅、数据中心、移动网络、VPN、代理、Tor、爬虫、滥用标记）。信誉分范围 0–100，越高越好；与网页相同，75–100 为 `good`、45–74 为 `moderate`、低于 45 为 `poor`。缺失或无效分数返回 `score: null`、`status: "unknown"`；缺失标记返回 `null`，不视为 `false`。

`format` 支持 `json`（默认）和 `text`。错误始终返回 JSON `{ "error": "…" }`：无效参数为 400、限流为 429、无法识别访客 IP 为 503、数据源故障或地址不匹配为 502。接口沿用现有请求限流，响应不缓存。健康度仅表示第三方 IP 信誉，不包含终端网络测速、浏览器检测或 AI 账号可用性判断。

## 界面预览

截图遮盖了 IP、具体位置及运营商 / ASN，数值不是实时结果。

![桌面首页（已打码）](docs/screenshots/desktop-home-redacted.png)

<table>
  <tr><th>手机 · 浅色</th><th>手机 · 深色</th></tr>
  <tr>
    <td><img src="docs/screenshots/mobile-home-light-redacted.png" alt="手机浅色首页（已打码）" width="360" /></td>
    <td><img src="docs/screenshots/mobile-home-dark-redacted.png" alt="手机深色首页（已打码）" width="360" /></td>
  </tr>
</table>

## 同步 Fork

如果你 Fork 了本仓库，在 GitHub 仓库页点击 **Sync fork → Update branch** 即可拉取更新。有本地改动时先看差异，冲突用合并处理。

## GitHub Actions 部署（可选）

Workers Builds 和 GitHub Actions 选择一种部署方式，避免重复发布。Actions 默认执行构建和测试；开启部署需要在仓库的 Actions 设置中添加：

| 类型     | 名称                    | 用途                       |
| -------- | ----------------------- | -------------------------- |
| Variable | `ENABLE_CF_DEPLOY=true` | 开启部署                   |
| Secret   | `CLOUDFLARE_API_TOKEN`  | 目标账户的 Worker 部署凭证 |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | 目标 Cloudflare 账户 ID    |

推送到 `main`，或运行 `Build and deploy one-ip`。构建和测试通过后进入部署。外部 PR 执行测试，不获得部署凭证。这些凭证用于 CI。

## 本地开发与部署

```bash
pnpm install --frozen-lockfile
pnpm worker:dev
```

打开 `http://127.0.0.1:8787`。命令启动 Vite 和本地 Worker，支持热更新。启动脚本为本地进程设置 `LOCAL_DEV=true`，无需修改 Wrangler 配置。

```bash
pnpm build
pnpm test
pnpm lint

# 登录 Cloudflare 并部署
pnpm exec wrangler login
pnpm run deploy
```

`pnpm run deploy` 使用 `dist` 中的构建产物，运行前需要执行 `pnpm build`。`make deploy` 包含版本更新、构建和部署，无需密钥文件。

## 项目结构与数据来源

- `src/app.css`：界面样式；`src/components/ui`：shadcn/ui 组件。
- `src/views`：网络、AI 与状态页面；`public/worker`：Worker API。
- Net.Coffee：IP 详情，展示字段取决于接口返回。
- Globalping：全球测量；IANA / RDAP：注册资料；各平台官方状态源：运行状态。

欢迎提交 Issue 和改进建议。分享截图前，请遮盖 IP、位置和指纹标识等隐私信息。

### Claude 环境对照

Claude 页面自动比较 `claude.ai` 与 `claude.com` 出口，并展示 DNS、WebRTC 和语言、时区等浏览器信息。检测失败、不同出口或中文偏好均不直接代表账号风险。未接入 Cloudflare 企业版 Bot Management；不展示推算的企业版分数。

Claude 页面本地检测简繁中文字体、厂商字体、UA / Client Hints、Intl 区域及 Canvas 国旗渲染。检测字典参考 LinXiaoTao/FuckClaude，来源摘要与 MIT 许可证位于 `vendor/claude-environment/`。不使用其风险分数；不把字体、厂商或中文偏好解释为国籍或封禁概率。页面仅展示简洁人机状态和逐项更新的检测日志，不提供评分卡或文本输入。
