# IP 质量检测源分析

当前地址查询只请求 `https://ip.net.coffee/api/ip/lookup/{ip}`，把一份打包结果当成“这个 IP 是什么”。下面对照你列出的站点：它们各自回答哪一类问题、哪些字段能进我们的档案、哪些只能外链。

本文只依据官方文档、产品页，以及 2026-09-17 对公开接口的实测。不把 HTML 页面当可抓取 API。条款与再分发细节见同目录 [ip-quality-sources-research.md](./ip-quality-sources-research.md)。

## 1. 先分清三件事

这些产品看起来都叫“查 IP”，实际在回答三类不同的问题：

1. **这是谁的网？** 国家、城市、ASN、ISP、公司、网段。
2. **这个地址通常拿来干什么？** 家庭宽带、移动、机房、CDN、教育网。判定粒度差很大。
3. **有没有匿名或滥用痕迹？** VPN / 代理 / Tor、欺诈、扫描爆破、黑名单。分数尺度互不兼容。

把 2 和 3 合成一个“纯净度”，或把多家分数平均，会得到一个没有定义的数字。

## 2. 各源能提供什么

### Net.Coffee（现状）

- 入口：`GET https://ip.net.coffee/api/ip/lookup/{ip}`，浏览器直连，无需密钥。
- 实测 `74.120.253.118`：`trust_score` 83、`is_datacenter` true、`isResidential` false、`company_type` hosting、公司名 Netaiclould LLC；同时 `asn_kind` 为 residential，ASN 33651 属于 Comcast Cable；`geo_sources` 里 Denver、美国质心、New York 同时出现。
- 已有字段：用途旗标、VPN/代理/Tor/爬虫/滥用、注册国 vs 定位国、CIDR、RPKI、历史、同机房邻居。
- 限制：来源标签是 `g1`/`g2`/`g3`/`g7`，不是可核对的厂商名；`trust_score` **越高越好**，和下面多数风控分方向相反。

### IPinfo.io

- 你给的 [What is my IP](https://ipinfo.io/what-is-my-ip) 是**访客出口**页，不是按目标 IP 查询。抓取时看到的是调用方地址，不是 `66.93.67.230`。
- [Lite API](https://ipinfo.io/developers/lite-api)：免费、无限次，需 token。只给国家/大洲 + ASN 名称和域名，没有城市，没有隐私检测。
- [定价](https://ipinfo.io/pricing)：城市级定位、hosting/mobile/anycast、隐私检测（VPN/Tor/proxy/relay）从 **Core $26/月** 起；公司、托管域名、abuse 联系人为 Enterprise。
- 独特价值：ASN 类型、隐私服务名、住宅代理活跃度。和 Net.Coffee 的“是不是机房”可对照，但不能替代 ping0 的网段级人工标注。

### IP2Location

- [Demo](https://www.ip2location.com/demo) 同样默认查**当前访客**。页面展示 DB26 地理库 + PX12 代理库（`usage_type`、`proxy_type`、供应商、`fraud_score`）。
- [IP2Location.io API](https://www.ip2location.io/ip2location-documentation)：无密钥每天 1000 次；注册免费套餐每月 5 万次。免费档只有国家/地区/城市、经纬度、ASN、`is_proxy`。
- 实测 `74.120.253.118` 无密钥响应：纽约、ASN 33651 Comcast、`is_proxy: false`；`usage_type` / `isp` / `fraud_score` / `proxy` 为 null。
- `usage_type`（ISP / MOB / DCH / CDN / EDU…）和完整 `proxy` 对象（含供应商、last seen、fraud score）在更高等级，尤其 Security。
- 独特价值：代理类型分类细，能给出 VPN 供应商名（Demo 样例为 ExpressVPN）。

### ping0.cc

- [指定 IP 页](https://ping0.cc/ip/66.93.67.230) 有 Turnstile / 阿里云验证码，不适合自动抓取。
- [FAQ](https://ping0.cc/ip/faq) 定义了它真正独特的字段：
  - **IDC vs 家庭宽带**：按网段人工标注“实际用在哪”，不是按 ASN 所有者类型。FAQ 写明其它站看的是所有者，ping0 看的是使用者；自称整体约 95% 准确。
  - “家庭宽带”= 非 IDC，可能是商业宽带或校园网。
  - **风控值**：越大越危险。15 内极度纯净，50 内安全，70 以上可拉黑。依据是扫描、爆破、爬虫、攻击、垃圾邮件、C&C，**和是不是住宅无关**。
  - **原生 IP**：注册国与定位国一致；否则广播 IP。
  - 另有 ASN/企业/注册地历史、同机房、共享人数、BGP 拓扑、适用场景。位置自称用全球节点 RTT，优先于第三方库。
- [API 页](https://ping0.cc/ip/api)：`curl ping0.cc` / `curl ping0.cc/geo` 只返回**调用方** IP。查指定 IP 的 JSON（`isidc`、`iprisk`、`isnative`、`asntype`）按页上说明为约 0.1 元/次、1 万次起购。
- 接入：不进入评分依据。HTML 有验证码，指定 IP JSON 未公布 URL。

### Scamalytics

- HTML 报告 [scamalytics.com/ip/{ip}](https://scamalytics.com/ip/66.93.67.230) 有 Cloudflare 拦截，不能当数据源抓。
- [产品页](https://scamalytics.com/products/)：自有欺诈分 0–100。70 约表示该 IP 上见过的用户里约 7/10 与欺诈相关；建议 0–19 放行、20–59 加验证、60–89 升级认证、90–100 阻断。分数来自运营商举报并扩散到同网段/ASN。
- [API v3](https://docs.scamalytics.com/ip-fraud-risk-api/v3/)：密钥必须放在自己的后端。免费档每月 5000 credits。Essential 一次返回自有分数，并附带 MaxMind GeoLite2、IPinfo、IP2Proxy Lite、FireHOL、IPsum、Spamhaus DROP、x4bnet、Google/AWS/Apple iCloud Relay 等开源/公开源。Premium 才有商业 ip2proxy、DB-IP 历史、住宅代理库。
- 独特价值：一家调用就能做“多源富集 + 自有欺诈分”。若接入它，不必再为同一层 geo/黑名单单独买 IPinfo Lite / MaxMind。

### IPQualityScore

- [Proxy Detection API](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview) 必须带 API key：`/api/json/ip/{KEY}/{IP}`。
- [响应字段](https://www.ipqualityscore.com/documentation/proxy-detection-api/response-parameters)：`fraud_score` 0–100；官方建议 ≥75 为可疑（常是代理/VPN，**不等于欺诈用户**），≥90 为高风险滥用。另有 `proxy` / `vpn` / `tor` / **`active_vpn` / `active_tor`**、`connection_type`、`recent_abuse`、`abuse_velocity`、`bot_status`。传入 `user_agent` 会改变分数。
- 独特价值：区分“曾经是 VPN”和“当前活跃 VPN”，以及滥用频率。不适合浏览器暴露密钥，也不该和 Scamalytics 分相加。

### IP-API.com

- 文档：[JSON endpoint](https://ip-api.com/docs/api:json)。任意 IP：`http://ip-api.com/json/{ip}`，无密钥。
- 实测 `74.120.253.118`：`proxy: true`、`hosting: false`、`mobile: false`，ISP Comcast，org SkyQuantum；`Access-Control-Allow-Origin: *`。免费档 **没有 HTTPS**（`https://ip-api.com/json/...` 返回 403）。
- 人看的演示页是 `https://ip-api.com/#{ip}`（站点用 hash 填查询）；Worker 仍走 `http://ip-api.com/json/{ip}`。
- 质量相关字段（官方定义）：`proxy` = Proxy / VPN / **Tor 出口**（三者合一布尔值，分不开）；`hosting` = 机房/托管；`mobile` = 蜂窝。
- 限制：免费端 45 次/分钟；文档写明 **不允许商业使用** 该免费端。Worker 只读这三项旗标，不当地理主源，也不合成欺诈分。
- 独特价值：公开 JSON 就能对照「是不是匿名出口 / 是不是机房」，补 IPinfo HTML 和 IP2Location 代理库之间的空档。

### proxycheck.io

- 文档：[API](https://proxycheck.io/api/)。无密钥每天 100 次，注册免费 key 每天 1000 次。v3：`https://proxycheck.io/v3/{ip}`。
- 实测 `74.120.253.118`：`proxy: false`、`vpn: false`、`tor: false`、`hosting: false`、`type: Residential`、`risk: 0`。和 IP-API `proxy: true`、IP2Location VPN **对着干**，所以值得并排，不能平均。
- [条款](https://proxycheck.io/terms/)允许在自己的服务里展示少量相关字段（例如是不是 VPN），**禁止把整份 API 结果原文转发出去**。Worker 只取 proxy / VPN / Tor / hosting / type / risk。
- 风险分 0–100，越高越危险；官方建议约 0–25 放行、26–65 挑战、66+ 视为很危险。和 ping0 风控值不是同一把尺子。
- 接入：Worker 读 v3 JSON，计入匿名/机房投票；风险分单独标来源，不和 Coffee / Scamalytics 相加。

### GetIPIntel

- [查找页](https://getipintel.net/free-proxy-vpn-tor-ip-lookup/)和 [API](https://getipintel.net/free-proxy-vpn-tor-detection-api/)：`http://check.getipintel.net/check.php?ip={ip}&contact={email}`，返回 0–1 的代理概率。>0.95 需人工看，>0.99 才建议自动处置；=1 表示动态名单上的机房/VPN/Tor。
- 没有联系邮箱会被拒（实测 `result: -6`）。查找页有 Turnstile，不能稳定深链到指定 IP。
- 接入：不进入评分依据。概率分不能和 IPQS / Scamalytics 混加，也不该用一个公开邮箱给全站访客代查。

### MaxMind minFraud

- [minFraud](https://dev.maxmind.com/minfraud/api-documentation/requests/) 是支付/注册交易评分：POST `device.ip_address` 加上订单、设备等字段，返回 0.01–99 的欺诈可能性。需要账号和 license key。没有「输入任意 IP 看分数」的公开页。
- [条款](https://www.maxmind.com/en/minfraud-service-terms-of-use)按交易场景处理 IP 与可选个人数据。Sandbox 只用三个测试 IP，分数还是假的。
- 接入：不进入评分依据。没有可外链的指定 IP 档案，也不能用自家 key 把分数转发给访客。

### ipdata.co

- [威胁字段](https://docs.ipdata.co/docs/proxy-tor-and-threat-detection)：`is_tor` / `is_proxy` / `is_datacenter` / `is_anonymous` / `is_known_attacker` / `is_known_abuser`。`is_vpn` 只在 Business / Enterprise。
- 必须 API key。免费档每天 1500 次，[条款](https://ipdata.co/terms-of-service.html)写明仅测试/开发、禁止商用，并禁止用机器人抓站点。无密钥调用返回 403。
- 接入：不进入评分依据。没有公开的指定 IP 查询页，也不该用免费 key 给全站代查。

### Spur

- [Context API](https://docs.spur.us/context-api?id=quick-start) 用 Token 查任意 IP，擅长住宅代理运营商、VPN 隧道、风险标签。这是目前名单里最接近「这个住宅 IP 是不是代理节点」的源。
- 人看的页是 [spur.us/context/{ip}](https://spur.us/context/1.1.1.1)；机房出口常会撞上 Vercel 挑战，所以不代抓。
- 接入：不进入评分依据。API 要 Token，Context 页在机房出口常被挑战。

### BrowserLeaks / ipleak.net

- [BrowserLeaks WebRTC](https://browserleaks.com/webrtc)、[DNS](https://browserleaks.com/dns) 和 [ipleak.net](https://ipleak.net/) 测的是**当前浏览器/当前出口**的 WebRTC 候选地址、DNS 解析器和 IPv6 是否漏出真实 ISP。
- 不能回答「被查的那个 IP 会不会泄漏」。本站首页 DNS / WebRTC 出口抽样和 `/webrtc` 页面做当前出口对照。
- 接入：不进入地址查询的评分依据。

### ip.skk.moe

- 首页 [ip.skk.moe](https://ip.skk.moe/) 是**访客出口**（本机 IPv4/IPv6、国内外探测），不能回答「这个被查 IP 是什么」。
- [IP 洞察](https://ip.skk.moe/query) 用 20+ 家地理库（IP.SB、IP-API、IPinfo、IPIP、IP2Location、CZ88 等）对照**同一地址**的国家/地区/城市/ASN。这是地理共识工具，**没有欺诈分、没有 VPN 库**。
- 页面在数据中心访问会被 Cloudflare 拦；查询在浏览器里分别打各家公开 API，不宜由我们的 Worker 再代抓一遍。
- 接入：不进入评分依据。Worker 无法代查；地理对照已由结果页的多源位置对比承担。

### WHOER（whoer.net）

- [whoer.net](https://whoer.net/) 是连接体检：当前出口的 ISP/ASN、Proxy、Anonymizer、Blacklist、DNS/WebRTC 泄露、浏览器指纹、数据中心 IP。
- 官方说明这些检查比较的是 IP 国家 vs DNS/时区/语言、请求头、常见代理端口。`?IP=` 查询参数**不会**改成查那个地址，页面仍显示打开它的人。
- WHOIS（[checkwhois](https://whoer.net/checkwhois)）才是按地址查登记信息，和匿名检测不是同一件事；本站已有注册局记录折叠。
- 接入：不进入评分依据。无法查询任意 IP 的匿名/泄露结果。

### IPPure

- 站点：[ippure.com](https://ippure.com/)，可 `?ip=` 查指定地址。定位是“纯净度检测台”：地理、风险、指纹、WebRTC/DNS 泄露、Cloudflare 环境。后几项是**当前浏览器/当前出口**，不是目标 IP 的属性。
- [我的 IP API](https://ippure.com/en/MyIP-Info-API)：`https://my.ippure.com/v1/info` 只返回**调用方**，beta。字段含 `fraudScore`、`isResidential`、`isBroadcast`。
- [FAQ](https://ippure.com/faq)：自有风险分来自蜜罐与风险库，会随时间衰减；没记录时按网段推断；**IPv6 不算分**。Cloudflare 风控 = `100 - Bot Score`，且 Cloudflare **不能**查询任意 IP，只对当前访问者有值。
- 独特价值：产品形态接近“给小白看的纯净度页”；作为数据源，指定 IP 没有稳定公开 API，Cloudflare 分不能用于 `/network/ip/:ip`。

## 3. 分数不能混加

| 分数                                  | 方向    | 官方含义                                    | 来源                                                                                             |
| ------------------------------------- | ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Net.Coffee `trust_score`              | 高 = 好 | 0–100 信誉                                  | 实测 + 现有 UI                                                                                   |
| Scamalytics `scamalytics_score`       | 高 = 差 | 约等于该 IP 用户中与欺诈相关的比例          | [产品页](https://scamalytics.com/products/)                                                      |
| IPQS `fraud_score`                    | 高 = 差 | ≥75 可疑（常为匿名），≥90 滥用              | [响应字段](https://www.ipqualityscore.com/documentation/proxy-detection-api/response-parameters) |
| ping0 `iprisk`                        | 高 = 差 | 扫描/爆破等行为；50 内安全，70+ 可拉黑      | [FAQ Q7](https://ping0.cc/ip/faq)                                                                |
| IP2Proxy `fraud_score`                | 高 = 差 | 代理库欺诈分；Security 档                   | [IP2Location.io](https://www.ip2location.io/ip2location-documentation)                           |
| IPPure `fraudScore`                   | 高 = 差 | 蜜罐/滥用，按段推断，IPv6 无                | [FAQ](https://ippure.com/faq)                                                                    |
| IP-API `proxy` / `hosting` / `mobile` | 是/否   | 匿名出口（VPN/代理/Tor 合一）/ 机房 / 蜂窝  | [JSON 字段](https://ip-api.com/docs/api:json)                                                    |
| proxycheck.io `risk`                  | 高 = 差 | 0–100；约 0–25 低、26–65 需挑战、66+ 很危险 | [Risk Score](https://proxycheck.io/api/)                                                         |
| GetIPIntel 概率                       | 高 = 差 | 0–1；>0.99 才建议自动处置                   | [API](https://getipintel.net/free-proxy-vpn-tor-detection-api/)                                  |
| minFraud `risk_score`                 | 高 = 差 | 0.01–99，针对**交易**不是孤立 IP            | [Terms](https://www.maxmind.com/en/minfraud-service-terms-of-use)                                |

同一数字 70，在 Scamalytics 是“七成欺诈关联”，在 ping0 是“可拉黑”，在 Coffee 是中上信誉。界面必须带来源名和方向，禁止合成一个“总纯净度”。

## 4. 用途分类也不能直接投票

| 源                        | “住宅 / 机房”实际指什么                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| ping0                     | 网段人工标注的**实际用途**；非 IDC 一律叫家庭宽带                          |
| IP2Location `usage_type`  | ISP / MOB / DCH / CDN / EDU / GOV… 登记用途                                |
| IPinfo ASN type / hosting | 自治系统类型 + 是否托管                                                    |
| IPQS `connection_type`    | Residential / Corporate / Education / Mobile / Data Center                 |
| Net.Coffee                | `is_datacenter` / `isResidential` / `company_type` / `asn_kind` 可互相矛盾 |
| IPPure `isResidential`    | 站点自己的住宅判定                                                         |

`74.120.253.118` 已出现：Coffee 标机房+托管公司，ASN 却是 Comcast 且 `asn_kind` 为 residential；IP2Location 免费档只看到 Comcast + 纽约、没有 usage_type。正确做法是**并排显示并标分歧**，而不是选一个赢的。

## 5. 建议接入方式

Worker 代查再把 JSON 展示给访客，等于向第三方再分发。多数付费源的条款把这条挡住；技术上能调，不等于能公开站用。

| 源                        | 建议                                       | 原因                                                                   |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| Net.Coffee                | 继续作主档案                               | 公开 JSON、CORS `*`；无官方 ToS 页，也无 SLA                           |
| IPinfo Lite               | 可谨慎聚合                                 | 无限国家+ASN，CC BY-SA，需署名；不要用无 token 的 `ipinfo.io/json`     |
| Scamalytics / IPQS        | **只外链**，除非拿到书面再分发许可         | 条款禁止向第三方再发布 API 响应；密钥也不能进前端                      |
| IP2Location.io            | **只外链**（无 Redistribution License 时） | Master License 限内部使用；把查询结果给公众视为再分发                  |
| ping0 指定 IP             | **不接入**                                 | HTML 有验证码；指定 IP JSON 的 URL/鉴权未公布                          |
| IPPure                    | **只外链**                                 | 公开 API 只查调用方；条款禁止抓取存储再分发                            |
| IP-API                    | 可聚合旗标                                 | 免费 JSON 有 CORS；只取 proxy/hosting/mobile；免费端禁止商用与 HTTPS   |
| proxycheck.io             | 可聚合旗标与风险分                         | 条款允许展示少量相关字段；禁止原文转发整份 JSON；免费无密钥 100 次/天  |
| GetIPIntel                | **不接入**                                 | 必须有效联系邮箱；查找页有验证码，不能稳定深链                         |
| MaxMind minFraud          | **不接入**                                 | 交易评分 API，没有指定 IP 的公开档案                                   |
| ipdata.co                 | **不接入**                                 | 必须 key；免费档禁止商用；VPN 字段要付费                               |
| Spur                      | **不接入**                                 | API 要 Token，机房出口常被挑战                                         |
| BrowserLeaks / ipleak.net | **不接入地址查询**                         | 测打开页面的 WebRTC/DNS 泄漏；首页抽样和 `/webrtc` 已覆盖              |
| ip.skk.moe                | **不接入**                                 | 洞察页是浏览器内多源地理表；首页是访客出口；机房出口会被 Cloudflare 拦 |
| WHOER                     | **不接入**                                 | 测当前连接的泄露/代理，不能查询任意 IP                                 |

不要把 IPPure / IPinfo What-is-my-IP / IP2Location Demo 当任意 IP 的 JSON 源。不要在 Worker 里用自家付费 key 代查再输出给匿名访客。

## 6. 结果页最终呈现

档案仍按一份文件来读，不堆六个仪表盘。

**标题区（已有）**  
查询的地址。

**三句结论（保留，改为多源共识）**

1. 用途：住宅 / 移动 / 机房 / 未知；来源打架时写“存在分歧”，hint 列出谁说什么。
2. 代理特征：命中 VPN、代理、Tor、托管匿名、住宅代理的**来源数**；不要只信 Coffee 的 false。
3. 原生性：注册国 vs 定位国（Coffee 已有，ping0/IPPure 同定义）。

**不要再把 Coffee `trust_score` 画成唯一质量环。** 改成带来源名的 Coffee 信誉，并在同一行放**外链**到 Scamalytics / ping0 / IPQS / IPPure，而不是用我们的 key 代查后再填格子。没有再分发许可之前，那些格子不是“未查询的数据”，而是“请到原站看”。

**位置 | 网络 | 风险**

- 位置：Coffee `geo_sources` 共识；若接入 IPinfo Lite，只对照国家/ASN（需署名）。
- 网络：ASN、组织、CIDR、ISP、公司；Coffee 内部字段并排，不和其他源的用途分类强行投票。
- 风险：用 Coffee 已有旗标。其它源通过外链核对，不要做成我们代查的多列矩阵。

**折叠**

- 注册局记录、全球延迟：保持。
- 多源位置对比：Coffee 已有 `geo_sources`；IPinfo Lite 最多补国家/ASN。
- 更多网络与历史：Coffee 已有字段。
- 在其它站点打开：`scamalytics.com/ip/{ip}`、`ping0.cc/ip/{ip}`、`ippure.com/?ip={ip}`、IPQS / IPinfo / IP2Location 的查询 URL。

**明确不展示**

- 气象站、海拔、日出、广告类目。
- 访客浏览器指纹、WebRTC/DNS 泄露、JA3、Cloudflare Bot（那些描述的是打开页面的人，不是被查的 IP）。
- 由多家分数加权得到的“总纯净度”。

## 7. 实施顺序（分析结论，尚未改代码）

1. **现在：** 结果页把 Coffee 信誉环标明来源；加 Scamalytics / ping0 / IPPure / IPQS 外链。可选：IPinfo Lite 只对照国家/ASN，并署名。
2. **有书面再分发/OEM 之后：** Worker 才能代查 Scamalytics、IPQS 或 IP2Location，并在档案里按源分列，永不合成单一质量分。
3. **不要做：** 浏览器直连付费 API、抓取带验证码的 HTML、无许可把付费 JSON 展示给访客、把 IPPure 的访客环境检测塞进 `/network/ip/:ip`。
