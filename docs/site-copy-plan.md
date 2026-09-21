# 全站文案与定位优化方案（修订版）

> 基于《SITE-COPY-PACK.md》评审修订，2026-09-21。
> 本文档为可执行版本：所有文案均已对齐现有路由与双语（zh/en）机制。

---

## 一、总体评估

### 原方案做对的事

1. **定位收窄是正确的差异化**：「给开了代理／分流的人」比「又一个 IP 查询」有记忆点，且与站内真实能力（双探针对照、网站分流出口、WebRTC 对照）完全匹配。
2. **克制话术体系完整**：每个高风险模块（质量分、AI、WebRTC）都配了免责句，这比绝大多数同类站专业。
3. **导航按任务而非按工具命名**，「概览／质量／出口／AI」一眼能看出产品叙事。

### 需要修正的问题

| #   | 问题                                                                             | 处理                                                                                                           |
| --- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | 「分流出」系笔误                                                                 | 改为「分流出口」                                                                                               |
| 2   | 口语过度：「人家挂了」「换节点党」「不做纯净度擂台」「顺手查」                   | 保留提问式标题的活力，但去掉俚语（见修订文案）                                                                 |
| 3   | 「按中美阵营看」中「阵营」有政治色彩                                             | 改为「按平台与线路分组」                                                                                       |
| 4   | 「第三方对照（打开即跳转，本站不代查处保持原政策）」句子不通                     | 重写为完整句                                                                                                   |
| 5   | 全案缺英文文案——本站是双语站（`src/i18n/en.json`），只改中文会造成英文页混杂     | 本方案补齐所有关键文案的 EN 版本                                                                               |
| 6   | 收窄定位有 SEO 代价：泛流量词（IP 查询、WHOIS、WebRTC 泄漏）全部让位             | 采用「品牌层新叙事 + 页面层保留检索词」的双层标题策略（见 SEO 节）                                             |
| 7   | 原品牌名「分流体检」中「体检」暗示健康结论，与「不做纯净度排名」的克制姿态有张力 | 更名为「出口观测台 / EgressScope」：观测站气质，与站内既有语言（出口观测／双探针／观察出口）一致，不暗示下结论 |
| 8   | 验收清单缺少英文语言环境与移动端截断检查                                         | 已补充                                                                                                         |

### 术语统一表（全站只准用这一套）

| 概念                     | 统一用词       | 禁用                 |
| ------------------------ | -------------- | -------------------- |
| 公网出口地址             | 出口           | 节点 IP、外网 IP     |
| 国内／海外两次探测       | 双探针         | 双检测、两次请求     |
| 机房／代理／VPN／Tor 等  | 特征标记       | 风险标签、黑点       |
| 多来源合成参考分         | 质量分（参考） | 信用分、安全分       |
| 平台无专属接口时的显示值 | 观察出口       | 猜测出口、估算出口   |
| 网站分流是否生效         | 按规则走       | 翻墙成功、翻没翻出去 |

---

## 二、品牌与全站壳

### 品牌

| 用途     | zh                                                    | en                                                                          |
| -------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 品牌名   | 出口观测台                                            | EgressScope                                                                 |
| 品牌副标 | IP 与出口诊断                                         | IP & egress diagnostics                                                     |
| PWA 短名 | 出口观测台                                            | EgressScope                                                                 |
| 页脚一行 | 面向代理与分流用户的出口诊断工作台 · 不提供纯净度排名 | An egress workbench for proxy & split-tunnel users — no purity leaderboard. |

> 命名取「观测」而非「体检／诊断」：与产品语言（双探针观测、观察出口）一致，且天然规避「下结论」的误读。副标与「不提供纯净度排名」保持与品牌名同框或同页出现。

### 主导航（改动 `src/layout/routes.ts`，路由不变）

| 路由              | 现名     | 新名（zh） | 新名（en）     | 一句话                     |
| ----------------- | -------- | ---------- | -------------- | -------------------------- |
| `/`               | 首页     | 概览       | Overview       | 双探针：出口有没有按规则走 |
| `/network/ip`     | 地址查询 | IP 质量    | IP quality     | 归属 + 质量分 + 特征标记   |
| `/ai/`            | AI 检测  | AI 出口    | AI egress      | 模型站连通／出口／官方状态 |
| `/status/`        | 服务状态 | 服务状态   | Service status | 官方状态聚合（次级心智）   |
| `/network/egress` | 出口检测 | 分流出口   | Split egress   | 网站／DNS／CDN 实际出口    |

次级工具（WHOIS、全球 Ping、文档）保持现有入口层级，不进主导航。

> 注意：`/network/ip` 同时承载域名 WHOIS 与全球 Ping 视图，导航名收窄为「IP 质量」后，页内 H1 必须兜住更宽的内容（见第 3 节）。

### 默认 OG／分享

- og:title（zh）：一眼看清代理出口有没有按规则走
- og:title（en）：See whether your proxy egress follows your rules
- og:description（zh）：双探针出口对照 · 分流／WebRTC · IP 质量分 · AI 平台出口 · ip.gogoxy.com
- og:description（en）：Dual-probe egress checks · split tunnel & WebRTC · IP quality score · AI platform egress · ip.gogoxy.com

### 全局免责（页脚可复用）

- zh：检测结果仅供网络排查参考，不代表任何平台的审核、风控或账号可用性结论。
- en：Results are for network troubleshooting only and do not represent any platform's review, risk-control, or account-eligibility decision.

---

## 三、首页 `/`

### SEO

- title：出口观测台与 IP 质量 · ip.gogoxy.com
- description：面向代理与分流用户：对照国内与海外出口是否按规则走，检查 WebRTC／DNS，并查看 IP 质量分与机房／代理特征标记。
- title（en）：Egress & IP quality checks · ip.gogoxy.com

### Hero

| 元素   | zh                                                                                           | en                                                                                                                                               |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 眉标   | 代理／分流用户专用                                                                           | For proxy & split-tunnel users                                                                                                                   |
| H1     | 出口有没有按规则走？                                                                         | Is your egress following your rules?                                                                                                             |
| 副标题 | 国内与海外双探针对照真实出口，并同步查看质量分与机房／代理特征标记。不承诺任何平台的通过率。 | Dual probes compare your real egress from inside and outside CN, with quality scores and hosting/proxy flags. No platform pass-rate is promised. |
| 主 CTA | 检测分流出口 → `/network/egress`                                                             | Run an egress check                                                                                                                              |
| 次 CTA | 查看 IP 质量分 → `/network/ip`                                                               | Check IP quality                                                                                                                                 |
| 第三链 | AI 平台出口与状态 → `/ai/`                                                                   | AI platform egress & status                                                                                                                      |

### 块① 出口对照

- 标题：本次访问，国内与海外是否同一条出口？
- 一致：两次探测观察到同一公网出口。
- 不一致：本轮观测到不同出口——分流可能已生效，建议再做网站分流核对。
- 提示：连线仅表示探针与回显地址的对应关系，不据此直接判定分流规则已生效。

### 块② 深检入口

- 标题：规则看着对，实际通没通？
- 三条：网站分流出口 · WebRTC UDP 对照 · IP 质量分与特征标记

### 块③ AI

- 标题：AI 平台：能不能连通、从哪条出口访问
- CTA：打开 AI 出口检测

### 质量分（首页一句）

质量分是多家来源合成的参考值，用于快速识别机房／代理特征；不是任何平台的官方判定。

---

## 四、IP 质量页 `/network/ip`、`/network/ip/:ip`

### SEO

- title（无 IP）：IP 质量与归属查询 · 出口观测台
- title（有 IP）：{ip} 的质量分与归属 · 出口观测台
- title（en）：IP quality & geolocation · EgressScope
- description：查询 IP 归属、ASN、质量分与机房／代理／VPN 等特征标记，用于判断出口画像；不保证任何平台的通过率。

> 保留「归属查询」字样以维持「IP 查询」类搜索词的相关性，这是双层标题策略的一部分。

### 页头

| 元素        | zh                                                     | en                                                                                              |
| ----------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| 眉标        | IP 质量                                                | IP quality                                                                                      |
| H1（无 IP） | 查一查这个出口的画像                                   | Profile this egress                                                                             |
| H1（有 IP） | {ip}                                                   | {ip}                                                                                            |
| 副标题      | 归属与质量分是排查材料，不是「能否通过某平台」的证明。 | Geolocation and quality scores are troubleshooting material, not proof of passing any platform. |

### 模块命名

| 原说法            | 新说法（zh）                                               | 新说法（en）                                                                 |
| ----------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 地址查询／IP 信息 | 归属与网络                                                 | Location & network                                                           |
| 质量分／场景分    | 质量分（参考）                                             | Quality score (advisory)                                                     |
| 风险／纯净        | 特征标记（机房／代理／VPN／Tor…）                          | Flags (hosting / proxy / VPN / Tor…)                                         |
| 多源外链          | 第三方对照（点击跳转至来源站点查询，本站不代理其查询请求） | Third-party cross-check (opens the source site; we do not proxy its queries) |

### 空状态／输入框

- placeholder：输入 IP 或网站（en: Enter an IP or website）
- CTA：查看质量分（en: Check quality）

### 结果解读（短句）

- 机房／托管（datacenter）：机房特征常见，不等于不可用，只是家庭宽带画像较弱。
- 代理／VPN：命中代理特征，各平台接受度不同。
- 住宅（residential）：偏家庭宽带画像，仍可能是住宅代理。
- 分数偏低：优先核对特征标记与 ASN，不要只看一个数字。

### 页内导流

查完质量分 →「对照这个 IP 在关键站点的实际出口」→ `/network/egress`
「查看 WebRTC 是否存在另一条 UDP 出口」→ `/webrtc`

---

## 五、分流出口 `/network/egress`

### SEO

- title：分流出口检测 · 网站／DNS／CDN · 出口观测台
- title（en）：Split-tunnel egress check · Sites / DNS / CDN · EgressScope
- description：检测访问各网站、DNS 与 CDN 时的实际出口，核对分流规则是否按预期生效。

### 页头

| 元素   | zh                                                                                              | en                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 眉标   | 分流出口                                                                                        | Split egress                                                                                                                      |
| H1     | 规则有没有真正生效？                                                                            | Are your rules actually working?                                                                                                  |
| 副标题 | 按站点、解析器与 CDN 来源查看实际出口；不同地址不能直接证明规则已完美生效，但足以定位分流问题。 | See real egress per site, resolver and CDN. Different addresses don't prove perfect rules, but they pinpoint split-tunnel issues. |

### Tab 文案

| Tab  | 标题     | 一句说明                               |
| ---- | -------- | -------------------------------------- |
| 网站 | 网站出口 | 关键站点回显的 HTTP 出口               |
| DNS  | DNS 出口 | 各解析器观察到的出口路径               |
| CDN  | CDN 采样 | 边缘节点延迟与来源对照（不作绑定证明） |

### 状态句

- 进行中：正在检测分流出口…
- 同出口：本轮已读取的站点主要走同一出口
- 多出口：观察到多个出口，请按站点核对规则
- 失败：出口检测受阻（跨域、接口或网络限制）

### 克制提示（保留并置顶）

按回显 IP 分组；不同地址不直接证明代理规则已生效，HTTP 出口仅作对照。

### CTA

检测全部 · 查看某出口的质量分（带入 `/network/ip/{ip}`）

---

## 六、WebRTC `/webrtc`

### SEO

- title：WebRTC 出口对照 · 出口观测台
- title（en）：WebRTC egress check · EgressScope
- description：对照 HTTP 出口与 WebRTC/STUN 的 UDP 候选地址，排查代理模式下的 UDP 分流或泄漏疑虑。
  （保留「泄漏」一词于 description，覆盖该搜索词。）

### 页头

| 元素   | zh                                                                               | en                                                                                                                   |
| ------ | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 眉标   | WebRTC                                                                           | WebRTC                                                                                                               |
| H1     | UDP 出口和网页出口一致吗？                                                       | Does your UDP egress match your web egress?                                                                          |
| 副标题 | 仅建立数据通道，不申请摄像头与麦克风。结果用于核对路由，不单独作为隐私审计结论。 | Data channel only — no camera or microphone. Results inform routing checks; they are not a standalone privacy audit. |

### 结论句模板

- 一致：本次采样的公网 UDP 出口与 HTTP 出口一致。
- 不一致：观测到与 HTTP 不同的 UDP 地址，请核对代理／TUN 的 UDP 规则。
- 无候选：未采集到公网候选；可能被限制或 UDP 被阻断，不能据此判定安全。
- 无 WebRTC：当前浏览器不支持 WebRTC。

### FAQ

- WebRTC「泄漏」到底指什么？
- 为什么系统代理与 TUN 模式的结果不同？
- 导语补充：出口不同仅说明 UDP 与 HTTP 走了不同路径，也可能正是预期的分流。

### 导流

结果不一致时 → 回 `/network/egress` 核对网站分流；→ `/network/ip/{udpIp}` 查看该 UDP 出口的质量分。

---

## 七、AI 出口 `/ai/` 与各平台子页

### SEO

- title：AI 平台出口与状态 · 出口观测台
- title（en）：AI platform egress & status · EgressScope
- description：检测 ChatGPT、Claude、DeepSeek、通义等平台的连通性、出口与官方状态；站点可响应不等于可登录或可对话。
- 子页 title：{平台} 网络出口检测 · 出口观测台

### 页头

| 元素   | zh                                                                                | en                                                                                                                 |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 眉标   | AI 出口                                                                           | AI egress                                                                                                          |
| H1     | 模型平台能不能连通、从哪条出口访问                                                | Can you reach AI platforms, and via which egress?                                                                  |
| 副标题 | 按平台与线路分组查看连通与出口；公开端点可响应 ≠ 可登录、可对话或已获得地区授权。 | Connectivity and egress by platform and route. A reachable public endpoint ≠ login, chat, or regional eligibility. |

### 列表卡字段

- 连通：可达／受阻／未知
- 出口：平台实测出口｜HTTP 默认观察｜UDP 观察（WebRTC）
- 属性：家宽／机房／代理等特征标记（有则显示）
- 官方状态：来自官方状态源的摘要

### 重要免责（页顶一条）

无专属实测接口的平台显示的是观察出口，可能与你真实访问该平台时的出口不同。

### 子页

- H1：{平台}：出口与连通
- 副标题：这是本次浏览器访问公开端点的观测结果，不是账号可用性证明。

### 分享卡文案

「{平台} 出口 {国家／城市} · {家宽／机房} · 官方状态 {正常／异常} · 来自 ip.gogoxy.com」

---

## 八、服务状态 `/status/`

### SEO

- title：AI 与云服务官方状态 · 出口观测台
- title（en）：Official status for AI & cloud services · EgressScope
- description：聚合 OpenAI、Claude、云厂商等公开状态页，便于与出口问题交叉排查。

### 页头

| 元素   | zh                                                                         | en                                                                                                         |
| ------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 眉标   | 服务状态                                                                   | Service status                                                                                             |
| H1     | 是你的网络，还是官方故障？                                                 | Is it your network, or an outage?                                                                          |
| 副标题 | 优先读取官方状态；无官方状态页时降级为可达性参考，并明确标注「仅供参考」。 | Official status first; where none exists we fall back to reachability signals, clearly marked as advisory. |

### 定位说明

本页是分流排查的配角：先排除官方故障，再回头检查出口与 WebRTC。

---

## 九、WHOIS／全球 Ping（次级页）

### WHOIS

- title：WHOIS／RDAP 查询 · 出口观测台
- H1：域名与 IP 注册信息
- 副标题：注册信息查询；隐私保护服务或注册商可能代替真实主体出现。

### 全球 Ping

- title：全球延迟抽样 · 出口观测台
- H1：这个出口在各地快不快？
- 副标题：多地探针的延迟参考，不是业务可用性保证。

---

## 十、API／curl 页（建议新增 `/docs/health`）

### 页头

- title：IP 健康报告 API · 出口观测台
- title（en）：IP health report API · EgressScope
- H1：一行 curl，查看出口画像
- 副标题：返回质量分与机房／代理等特征标记，便于脚本化排查与节点切换后的对比。

### 示例

```bash
curl -sS "https://ip.gogoxy.com/api/ip/health?ip=8.8.8.8&format=text"
```

### 字段说明

| 字段                             | 含义                                      |
| -------------------------------- | ----------------------------------------- |
| score／status                    | 参考分与档位，越高通常画像越「干净」      |
| datacenter／residential／mobile  | 网络用途画像                              |
| vpn／proxy／tor／abuser／crawler | 特征标记；命中 ≠ 恶意，但可能影响平台验证 |

### 传播一句

更换节点后再次请求，即可对比 score 与 flags 的变化。

---

## 十一、关于／隐私／条款

### 关于（三句）

1. 出口观测台（ip.gogoxy.com）帮助代理与分流用户核对出口是否按规则走。
2. 同时提供 IP 质量分、WebRTC 对照、AI 平台出口与官方状态聚合。
3. 我们提供排查材料，不做「保证通过平台审核」的承诺。

### 隐私（开头段）

不强制登录；WebRTC 检测仅建立数据通道；浏览器直连目标站点时，对方可见该次请求的出口 IP。详见隐私政策全文。

---

## 十二、对外推广固定话术

### 短简介（50 字内）

开了代理，却不确定规则有没有生效？ip.gogoxy.com：双探针、网站分流、WebRTC、IP 质量分，一站查清。

### 中简介

ip.gogoxy.com 是面向代理与分流用户的出口工作台：对照国内与海外出口是否一致、关键站点实际从哪条出口访问、UDP 是否另有出口，并给出 IP 质量分与特征标记；同时支持 AI 平台连通、出口与官方状态查询。不提供纯净度排名。

### 对比边界（内部话术，不对外点名）

- 不止回答「我的 IP 是什么」，而是回答「出口有没有按规则走」
- 不打「权威纯净度」牌，强调多来源参考与克制结论
- 差异化：全平台 AI 出口、健康分 text API、清晰的「规则是否生效」叙事

---

## 十三、SEO 双层标题策略（新增）

收窄定位不等于放弃泛流量。规则如下：

1. **品牌层**（og、首页 H1、页脚）：全部使用新叙事「出口观测台／出口按规则走」。
2. **页面层 title**：新叙事在前，保留检索词在后——
   - `IP 质量与归属查询 · 出口观测台`（留住「IP 查询」）
   - `WHOIS／RDAP 查询 · 出口观测台`（留住「WHOIS」）
   - description 中保留「泄漏」「连通性」等高频检索词。
3. 不新增任何关键词堆砌；每页 title ≤ 30 个汉字为宜。

---

## 十四、落地文件映射

| 改动                         | 文件                                                               |
| ---------------------------- | ------------------------------------------------------------------ |
| 导航名                       | `src/layout/routes.ts` + `src/i18n/en.json`                        |
| 品牌名／页脚一行             | `src/components/site-brand.tsx`、`src/layout/index.tsx`、`en.json` |
| 默认 title／meta description | `index.html`、`src/i18n/index.ts`                                  |
| OG／twitter 默认             | `index.html`                                                       |
| 首页 Hero 与三块             | `src/views/home/index.tsx`                                         |
| IP 质量页头／空状态／导流    | `src/views/lookup/index.tsx`、`src/views/ip/`                      |
| 分流出口页头／Tab／状态句    | `src/views/egress/index.tsx` 及相关组件                            |
| WebRTC 页头／结论句／FAQ     | `src/views/webrtc/index.tsx`                                       |
| AI 列表页头／免责／分享句    | `src/views/ai/index.tsx`、`src/views/ai/camp-card.tsx` 等          |
| 服务状态页头                 | `src/views/status/index.tsx`                                       |
| WHOIS／Ping 页头             | `src/views/whois/index.tsx`、`src/views/ping/index.tsx`            |
| 新增 curl 文档页             | 新增 `/docs/health` 路由（`src/App.tsx`）                          |
| 全部新中文文案               | 必须同步补齐 `src/i18n/en.json`，否则英文环境回退显示中文          |

## 十五、实施顺序

1. 全局：品牌名、导航名、默认 title／description／og（含 en.json）
2. 首页 Hero + 三块叙事
3. `/network/egress`、`/webrtc`、`/network/ip` 页头与免责
4. `/ai/` 列表与分享句
5. `/docs/health` curl 页
6. `/status/`、WHOIS、Ping 配角文案
7. 关于／页脚一行

## 十六、验收清单

- [ ] 任意主页面 title 不再只剩「IP 查询／IP 网络工具」
- [ ] 导航能看出「分流／质量／AI」的任务叙事，而非工具堆砌
- [ ] 每页有一句「受众 + 目的」副标题
- [ ] 质量分／AI／WebRTC 均带「不等于过检／可登录」免责
- [ ] 分享默认文案含「出口／分流」而非仅「查 IP」
- [ ] **英文语言环境逐页走查**：无中文残留、无机器味直译
- [ ] **移动端导航新名称不截断**（390px 宽走查）
- [ ] 页面层 title 仍保留「IP 查询／WHOIS／泄漏」等检索词（双层策略）
- [ ] 品牌名出现的页面，副标或「不提供纯净度排名」同框可见
