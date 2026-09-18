# IP 质量 / 情报来源调研（一级资料）

调研日期：2026-09-17。只依据官方站点、文档、定价、条款与（在公开且无需密钥时）实测响应。未在官方页面写明的配额、接口或条款一律标为**未公开**。产品侧结论与页面结构见 [ip-quality-sources-analysis.md](./ip-quality-sources-analysis.md)。

CORS 说明：Cloudflare Worker **出站 `fetch` 不受浏览器 CORS 限制**；CORS 只约束 **SPA 浏览器直连**。Worker 把付费 API 结果原样返回给访客，通常等于向第三方再分发。

---

## 1. Scamalytics

官方站 [scamalytics.com](https://scamalytics.com)。HTML 查询例：`https://scamalytics.com/ip/66.93.67.230`（本环境对该路径与条款页返回 Cloudflare 拦截页，未能核对该 IP 的 HTML 正文）。首页称产品为「IP Address Fraud Check」：查 IP、欺诈分、提供 API；客户在银行、支付、分类信息、约会等场景。([scamalytics.com](https://scamalytics.com))

**回答的问题：** 该 IP 对网站/应用的**网页用户连接**有多大欺诈风险，以及是否代理/VPN/TOR/机房。首页声明评分**不是**对全网或服务器对服务器连接的断言。([scamalytics.com](https://scamalytics.com)、[scamalytics.com/ip](https://scamalytics.com/ip))

**HTML 页声称展示：** 欺诈分、真实国家、运营商、代理状态、Tor。([scamalytics.com/ip](https://scamalytics.com/ip)) 另有 MMDB 本地库与 CSV 批量查询。([scamalytics.com](https://scamalytics.com))

**商业 API（v3）关键字段：** `scamalytics_score`（0–100，约等于「该 IP 上见过的用户中与欺诈相关的比例」，70 ≈ 7/10）、`scamalytics_risk`（low 0–19 / medium 20–59 / high 60–89 / very high 90–100）、`scamalytics_url`、`scamalytics_isp_score` / `scamalytics_isp_risk`、`scamalytics_proxy`（`is_datacenter` / `is_vpn` / `is_apple_icloud_private_relay` / `is_amazon_aws` / `is_google`）、`is_blacklisted_external`；Premium 才填充 `scamalytics_isp` / `scamalytics_org`。`external_datasources` 含 ip2proxy_lite、MaxMind GeoLite2、IPinfo、FireHOL、IPsum、Spamhaus DROP、x4bnet、Google、AWS、Apple Private Relay；Premium 另有 DB-IP 与完整 ip2proxy。([docs.scamalytics.com/ip-fraud-risk-api/v3](https://docs.scamalytics.com/ip-fraud-risk-api/v3/))

**访问模型：** HTML 查询站 + **用户名 + API key** 的 JSON（`https://api11.scamalytics.com/v3/{username}?key=…&ip=`，EU 节点 `api12`）。文档要求密钥不得进前端。另售 MMDB。**未公开 CORS。** ([docs](https://docs.scamalytics.com/ip-fraud-risk-api/v3/))

**配额：** 免费档 **每月 5,000 credits**，每次成功 live 调用 1 credit，按自然月重置；`test=1` 不扣点，免费账号测试调用上限 **250/月**。([docs](https://docs.scamalytics.com/ip-fraud-risk-api/v3/)) 定价页写免费档含欺诈分、开源地理、公开代理、机房、ASN、外部黑名单、开源 VPN/TOR；未用额度不结转。([scamalytics.com/ip/api/pricing](https://www.scamalytics.com/ip/api/pricing))

**条款：** 禁止未经书面同意转售/分发 Service；**明确禁止爬虫/脚本抓取网站**。([scamalytics.com/terms-of-service](https://www.scamalytics.com/terms-of-service/)) 公开诊断站把 API JSON 展示给访客，属于向第三方分发，需书面许可。

**重叠 / 独特：** 地理、ASN、代理类型与 IP2Location/IPinfo 同源或同类；**独特**是自有欺诈概率分 + ISP 级风险，以及把多家开源/商业源归一到一次响应。

---

## 2. IPinfo.io

**回答的问题：** 地理（国家→城市）、ASN、公司、匿名/隐私（VPN/代理/Tor/relay/hosting）、运营商、任播/bogon。欺诈「分数」不是产品核心；隐私检测是布尔/服务名。([ipinfo.io/developers/data-types](https://ipinfo.io/developers/data-types))

### HTML「What is my IP」vs API

[`/what-is-my-ip`](https://ipinfo.io/what-is-my-ip) 是**访问者** HTML：城市/州/国家、ASN 与类型、hostname、网段、Company、hosted domains、Privacy、Anycast、Abuse 联系人，以及 VPN/Proxy/Tor/Relay/Hosting/Residential Proxy 等展示位。这不是任意 IP 的 JSON API。

无 token 的 `https://ipinfo.io/json` 实测返回城市级 JSON，并带 `"readme": "https://ipinfo.io/missingauth"`，响应头 `access-control-allow-origin: *`。官方现行免费档是 **IPinfo Lite**，走 `https://api.ipinfo.io/lite/{ip|me}?token=`，字段只有 `ip, asn, as_name, as_domain, country_code, country, continent_code, continent`。([ipinfo.io/developers](https://ipinfo.io/developers)、[lite-api](https://ipinfo.io/developers/lite-api))

### 付费 / 企业 API 字段

- **Lite（免费、无限）：** 国家 + 大陆 + ASN 名/域。([lite](https://ipinfo.io/lite)、[lite-api](https://ipinfo.io/developers/lite-api))
- **Core：** 城市/邮编/坐标/时区；`as.type`；`is_anonymous, is_hosting, is_anycast, is_mobile, is_satellite`；`anonymous.is_*`。150k–5M 请求/月。([core-api](https://ipinfo.io/developers/core-api)、[pricing](https://ipinfo.io/pricing))
- **Plus：** 完整隐私摘要（`/anonymous`：`name, is_proxy, is_relay, is_tor, is_vpn`）+ carrier + geo 精度。([privacy-detection-api-data](https://ipinfo.io/developers/ip-privacy-detection-api-data)、[plus-api](https://ipinfo.io/developers/plus-api))
- **Max：** 另加 **住宅代理** `is_res_proxy, last_seen, percent_days_seen`。([privacy-detection-api-data](https://ipinfo.io/developers/ip-privacy-detection-api-data)、[pricing](https://ipinfo.io/pricing))
- **Company（仅 Custom/企业）：** `GET https://ipinfo.io/{ip}/company` → `name, domain, type`（isp/business/education/hosting/government）。与 ASN 类型不是同一字段。([company-api](https://ipinfo.io/developers/company-api))
- **Privacy Standard / Extended（企业 Custom）：** `/privacy`：`vpn, proxy, tor, relay, hosting, service`；Extended 加 `confidence, coverage, census, vpn_config, first_seen, last_seen` 等。([privacy-standard-api](https://ipinfo.io/developers/privacy-standard-api)、[privacy-extended-api](https://ipinfo.io/developers/privacy-extended-api))

**访问模型：** 免费 Lite 仍要 **token**（query / Basic / Bearer）。文档写明 **JSONP 与 CORS 支持客户端**。([developers](https://ipinfo.io/developers)) 超限 429。Lite **无日/月上限**。([developers](https://ipinfo.io/developers)、[lite](https://ipinfo.io/lite))

**条款：** 网站 ToS 禁止爬取 Site Content，内部使用可以、转售需书面同意，对外商用走 OEM。([terms-of-service](https://ipinfo.io/terms-of-service)) AUP：禁止把 Services/数据分享给未授权第三方，**「unless you are using the API Services」** 可把数据纳入自有产品。([acceptable-use-policy](https://ipinfo.io/acceptable-use-policy)) **Lite 明确 CC BY-SA 4.0**，可进产品，需署名「IP address data is powered by IPinfo」。([lite](https://ipinfo.io/lite)) Core/Max 定价表「Commercial License / Use our data in your products」在 Lite 为 attribution，更高档为勾选/企业。([pricing](https://ipinfo.io/pricing)) 标准订户把付费字段再展示给公众，官方仍指向 OEM。([oem-licensing](https://ipinfo.io/enterprise/oem-licensing))

**重叠 / 独特：** 地理/ASN 与几乎所有源重叠。**独特：** 无限免费国家+ASN（可再分发）、住宅代理频次、Places、公司 vs ASN 拆分、隐私检测方法论字段。

---

## 3. ping0.cc

中文 IP 风控站。[FAQ](https://ping0.cc/ip/faq) 与 [API 页](https://ping0.cc/ip/api) 为一级说明。指定 IP HTML：`https://ping0.cc/ip/66.93.67.230` 在打开时先走 **Cloudflare Turnstile / 阿里云验证码**，未登录环境看不到完整报告正文。

**回答的问题：** 自研定位（全球节点 RTT，优先于第三方库）、**实际用在家庭宽带还是 IDC**（不是 ASN 所有者类型）、原生 vs 广播、风控值（扫描/爆破/爬虫/攻击/垃圾邮件/C2）、ASN/企业/注册地历史、共享人数、BGP 拓扑、适用场景。([faq](https://ping0.cc/ip/faq))

**HTML（FAQ 描述的字段，非本环境渲染核对）：** IDC vs 家庭宽带；风控值色阶（≤15 极纯净 … ≥70 可拉黑）；原生/广播；大模型「商业宽带」；ASN/企业/注册地历史；同机房供应商；共享人数（大陆默认不展示）；CDN 反代标记；适用场景；位置置信度 0–100。([faq](https://ping0.cc/ip/faq))

**公开接口（仅当前访问者，非任意 IP）：**

- `curl ping0.cc` / `ipv4.ping0.cc` / `ipv6.ping0.cc` → 纯 IP 文本
- `curl ping0.cc/geo` → 四行：IP、位置、ASN、商家
- 前端 JSONP；签名档图片 `https://ping0.cc/img1` / `img2`

([ping0.cc/ip/api](https://ping0.cc/ip/api))

**指定 IP JSON：** API 页给出示例字段 `ip, location, country, province, city, asn, asnname, org, isidc, iprisk, isnative, asntype, orgtype`，价格 **0.1 元/次、1 万次起购**。**该页未公布请求 URL、鉴权头或 CORS。** 不得臆造 endpoint。([api](https://ping0.cc/ip/api))

**条款：** 页脚「© 2021–2026 ping0.cc 所有权利保留」。未见单独 ToS 页。HTML 有验证码，适合 **外链** 而非抓取。

**重叠 / 独特：** 风控分/机房/原生与 IPpure、Coffee、IPQS 同类但定义不同。**独特：** 人工标注「实际使用点」、RTT 定位、共享人数、BGP 快照。

---

## 4. IP2Location / IP2Location.io

同一主体 Hexasoft。须拆三条产品线。

### Demo HTML（ip2location.com）

[`/demo`](https://www.ip2location.com/demo) 免费查当前（或表单）IP。地理来自 **DB26**，代理来自 **PX12**。HTML 字段含国家/地区/城市/坐标、ISP、网速、ZIP、MCC/MNC、usage type、address type、IAB category、ASN/AS domain/CIDR；代理侧 Anonymous、proxy type、last seen、provider、**Fraud Score**。页内还嵌了一份与 io Security 计划同形的 JSON（`is_proxy, fraud_score, proxy.*`）。这是演示页，不是稳定公共 API。

### IP2Location.io REST API

[`api.ip2location.io`](https://www.ip2location.io/ip2location-documentation)：**可无 key**，**1000 次/日**（00:00 UTC 重置）；Free Plan **key + 50,000/月**。字段随套餐：Free 约 `ip, country_*, region_name, city_name, lat/lon, zip, time_zone, asn, as, is_proxy`；更高档 `isp, domain, net_speed, usage_type, district, as_info, proxy.*, fraud_score`（**0–99**，越高越差）。`proxy_type`：VPN/TOR/DCH/PUB/WEB/SES/AIC/RES/CPN/EPN。官方**未写 CORS**；本环境对无 key GET **未见** `Access-Control-Allow-Origin`。Worker 可调；浏览器直连未证实。

### 可下载 DB

商业 **DB26 / IP2Proxy PX12** 等，CSV/BIN/CIDR，按服务器许可。([ip2location.com/documentation/ip2location-database-db26](https://www.ip2location.com/documentation/ip2location-database-db26)) **LITE** 免费、月更、个人或商用需署名；IP2Proxy LITE **仅公开代理 PUB**，商业版才含 VPN/Tor/DCH/RES 等。([lite.ip2location.com](https://lite.ip2location.com/)、[ip2proxy-lite](https://lite.ip2location.com/ip2proxy-lite)、[database/lite](https://www.ip2location.com/database/lite))

**条款：** Master License：Standard/Site **仅内部使用，禁止再分发**；未经 Redistribution License 不得把数据做成对外 web service / 公开展示给他人。([ip2location.io/ip2location_master_license_agreement.pdf](https://www.ip2location.io/ip2location_master_license_agreement.pdf)、[lite terms](https://lite.ip2location.com/terms-of-use)) LITE 产品页写「商用免费但要署名」，与 MLA 的再分发禁令并存——公开站把查询结果展示给访客，应按 **再分发** 处理，除非另购 Redistribution License 或只做外链。

**重叠 / 独特：** 代理分类与 Scamalytics ip2proxy、IPQS connection_type 重叠。**独特：** usage_type 编码、IAB 广告类、PX 威胁细分、可离线 BIN。

---

## 5. IPQualityScore（IPQS）

官方 IP 信誉接口即 **Proxy & VPN Detection API**（文档称 IP Reputation）。([documentation/overview](https://www.ipqualityscore.com/documentation/overview)、[proxy-detection-api/overview](https://www.ipqualityscore.com/documentation/proxy-detection-api/overview))

**回答的问题：** 代理/VPN/Tor/匿名、**欺诈概率**、近期滥用、bot、连接类型（Residential/Corporate/Education/Mobile/Data Center）。面向注册、支付、点击欺诈，不是纯地理库。

**关键字段：** `proxy, vpn, tor, active_vpn, active_tor, ISP, organization, ASN, host, country_code, city, region, latitude, longitude, zip_code, timezone, connection_type, is_crawler, recent_abuse, abuse_velocity, bot_status, mobile, fraud_score`；企业点 `frequent_abuser, high_risk_attacks, shared_connection, dynamic_connection, security_scanner, trusted_network`；传入 UA 时有 OS/browser/device。`fraud_score`：≥75 可疑（常见于代理/VPN，**不等于**已确认欺诈），≥90 高风险建议拦截。([response-parameters](https://www.ipqualityscore.com/documentation/proxy-detection-api/response-parameters))

**访问模型：** `https://ipqualityscore.com/api/json/ip/{API_KEY}/{IP}`。**必须 API key**。未公开 CORS；密钥在 URL 中，**不能**给 SPA。另有离线 IP Reputation DB。

**配额：** 免费 **1,000 lookups/月、35/日**；Startup $99/月 5,000/月、250/日。一次有效 Proxy/Email/Fingerprint 请求扣 1 credit。403 = 限流。([plans](https://www.ipqualityscore.com/plans)、[create-account](https://www.ipqualityscore.com/create-account)、[api-style-guide](https://www.ipqualityscore.com/documentation/about-ipqs-apis/api-style-guide))

**条款：** 禁止向第三方 **转售或再发布 API 响应**；禁止做实质相同的公开 API 客户端。([terms-of-service](https://www.ipqualityscore.com/terms-of-service) §16) 公开诊断站服务端代查并展示，会被这条挡住。

**重叠 / 独特：** 与 Scamalytics 同属欺诈分家族但阈值不同。**独特：** `connection_type` 五类、`recent_abuse`/`bot_status`、住宅代理（SMB+）、交易/邮箱/电话联查。

---

## 6. IPpure（ippure.com）

官方站 [ippure.com](https://ippure.com/) / [en](https://ippure.com/en/)：IP 纯净度（跨境电商、广告、流媒体、AI、爬虫）：地理、风险、指纹、VPN/WebRTC/DNS 泄露。Cloudflare 环境检测页说明 Open/Residential/Corporate Proxy 与 Bot Score 转换。([cloudflare](https://ippure.com/en/cloudflare)、[faq](https://ippure.com/en/faq))

**回答的问题：** 风险分（滥用：代理、垃圾邮件、爬虫、欺诈）、是否住宅、是否广播（注册地≠实际国家）、指纹/泄露。IPv6 **不打分**。([faq](https://ippure.com/en/faq))

**公开 JSON（仅调用者 IP，非任意 IP）：** `GET https://my.ippure.com/v1/info`（beta）。示例字段：`ip, asn, asOrganization, country, countryCode, region, regionCode, city, timezone, longitude, latitude, postalCode, fraudScore, isResidential, isBroadcast, userAgent`。中文页把 `isResidential` / `isBroadcast` 解释为「是否原生 / 是否机房」——与英文字段名不完全同义。**未文档化任意 IP 参数、配额、CORS。** 本环境响应无 `Access-Control-Allow-Origin`。([MyIP-Info-API](https://ippure.com/en/MyIP-Info-API)、[中文](https://ippure.com/MyIP-Info-API))

另有访问者图片卡 `https://my.ippure.com/v1/card`。([MyIP-Info-Card](https://ippure.com/en/MyIP-Info-Card))

**条款：** 未经授权禁止程序化高频/批量访问、系统抓取存储再分发、镜像或竞争性衍生服务；禁止绕过频率/风控。([terms-privacy](https://ippure.com/terms-privacy)) 公开站 Worker 代查任意 IP（即便发现了未文档接口）不符合该条。

**重叠 / 独特：** 风险分/住宅/广播与 ping0、Coffee 重叠。**独特：** 面向「纯净度」用户的 CF Bot 对照与浏览器环境套件；**没有**文档化的任意 IP 信誉 API。

---

## 7. ip.net.coffee（本应用当前上游）

站点：[ip.net.coffee](https://ip.net.coffee/)、HTML 查询 [ip.net.coffee/ip/](https://ip.net.coffee/ip/)。文案：家宽/机房、人机流量、多源比对、经纬度、端口、滥用、黑名单、全球延迟。HTML 例称先 SSR 缓存快照再拉完整检测。**未找到官方 API 文档、配额或 ToS 页。**

应用使用：`GET https://ip.net.coffee/api/ip/lookup/{ip}`。本环境 **200 JSON**，`access-control-allow-origin: *`，`cache-control: public, max-age=600`。Worker 与浏览器直连在协议上都可行。速率限制 **未公开**。

**实测 payload 键（66.93.67.230 与 1.1.1.1，非契约）：**  
身份/网段：`ip, cidr, range, rdns, src`  
网络：`asn, asname, asOrganization, asn_kind, asn_tbps, asn_ipv4_count, asn_allocated, isp, company_name, company_type, datacenter_name, rpki_status`  
地理：`country, countryCode, region, city, registered_country(_code), geo_sources[]`  
使用/风险：`is_bogon, is_datacenter, isResidential, is_vpn, is_proxy, is_tor, is_crawler, is_abuser, is_mobile, is_public_service, public_service, abuser_score, trust_score, reddit_blocked, intelligence{threats, abuser_level, …}, vpn_trace`  
历史/邻居：`location_history, asn_history, company_history, dc_neighbors, related_domains`  
解释：`ai_verdict{label, confidence, reasoning}`

`trust_score` 为 0–100 且样例中公共 DNS 为 41、普通地址为 78，**极性是「越高越可信」**，与 IPQS/Scamalytics/ping0/IP2Proxy「越高越危险」相反。HTML 标题也写「信任评分」。

**条款风险：** 无公开 ToS，**不表示**允许无限再分发；应视为未授权的第三方、可能随时改形状或加鉴权。本仓库已用 zod 做窄校验。

**重叠 / 独特：** 几乎覆盖其他源的字段家族。**独特：** 多源 `geo_sources`、公司/ASN 历史、`dc_neighbors`、`ai_verdict`、RPKI、公开服务识别。这正是 SPA 现在只调它的原因。

---

## 8. 综合

### 8.1 值得聚合 vs 只外链

| 做法                              | 来源                                                                           | 原因                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| **继续聚合（已在用）**            | ip.net.coffee lookup JSON                                                      | 公开 JSON、CORS `*`、字段覆盖身份/网络/使用/风险/历史；无官方禁令文本，但无 SLA |
| **可谨慎聚合（需 token + 署名）** | IPinfo **Lite**                                                                | 无限、CC BY-SA、文档允许进产品；只补国家/ASN 共识，不要当欺诈源                 |
| **Worker 技术可调、法务通常不行** | IP2Location.io（无 Redistribution License）、IPQS、Scamalytics                 | 条款禁止向第三方再发布 API 数据；密钥也不能进前端                               |
| **仅外链 HTML**                   | Scamalytics `/ip/{ip}`、IPQS 查询页、ping0（验证码）、IPpure、IP2Location demo | 反爬/验证码/ToS；IPpure 无任意 IP API                                           |
| **调用者 IP 小工具（非 lookup）** | ping0 `/geo`、IPpure `/v1/info`、IPinfo `/lite/me`                             | 只描述访客，不能替代指定 IP 档案                                                |

### 8.2 建议的统一字段模型（展示层，不是把分数加总）

每条记录带 `source`, `fetched_at`, `license`。

- **identity：** `ip`, `ptr/rdns`, `cidr/range`, `hostname`
- **network：** `asn`, `as_name`, `as_type`, `isp`, `company{name,type,domain}`, `rpki`
- **usage：** `usage_class`（residential / hosting / mobile / isp / education / unknown）、`native_or_broadcast`、`anycast/bogon`
- **risk：** **按源分列** 的 flags（vpn/proxy/tor/relay/abuser/bot）与 **按源分列** 的 score（保留原名与极性）
- **consensus：** 仅对可对齐的离散事实投票（国家码、是否 hosting）；冲突标 `disagreement`，不打总分
- **provenance：** 上游 URL、套餐档、原始 JSON 引用

### 8.3 不要合并的东西

- **不要**把 `trust_score`（Coffee，高=可信）与 `fraud_score` / `scamalytics_score` / `iprisk` / IP2Proxy 0–99（高=危险）加减或平均。
- **不要**把 IPQS「≥75=可疑代理」当成 Scamalytics「70≈七成欺诈用户」或 ping0「70=可拉黑」（ping0 看扫描/爆破/C2，不是支付欺诈）。
- **不要**把「ASN type = isp」当成「家庭宽带」（ping0 FAQ 专门反对这一点）。
- **不要**把 IPinfo `company.type` 与 `as.type`、Coffee `company_type` 当成同一公司。
- **不要**把 IPpure/ping0「原生/广播」当成 VPN 检测。

### 8.4 对「Cloudflare Worker + 浏览器 SPA、目前只调 Coffee」的建议

1. **lookup 主路径维持 Coffee。** 浏览器可继续直连（已有 CORS）；Worker `/api/ip/health` 继续作终端入口。把 Coffee 字段映射进上一节模型，**分数只打 Coffee 标签**。
2. **共识层最多加 IPinfo Lite**（Worker 存 token）：国家/大陆/ASN 与 Coffee `geo_sources` 对照；署名链接。不要用无 token 的 `ipinfo.io/json` 当稳定契约（`missingauth`）。
3. **欺诈竞品全部外链：** `scamalytics.com/ip/{ip}`、IPQS、ping0、IPpure、IP2Location demo。不要在 Worker 里用自家 key 代查再输出给匿名访客。
4. **不要解析/爬 HTML。** Scamalytics 与 ping0 有 Cloudflare/验证码；IPpure/Scamalytics 条款禁止系统抓取。
5. **若将来要第二欺诈源：** 走书面再分发/OEM（Scamalytics、IPQS、IP2Location Redistribution），在结果里并排展示，永不合成单一「质量分」。
6. **不要**为了「多源」把 IPQS/Scamalytics 密钥放进 SPA。
