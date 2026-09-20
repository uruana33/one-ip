# 其他页面的结论与证据展示审查

> 后续状态：本清单 23 项已按授权分组修复，详见 [修复与验证记录](./page-conclusions-fixes-2026-09-20.md)。下文保留修复前的问题证据。

日期：2026-09-20（Asia/Taipei）。范围是当前工作区的活跃页面，包含既有未提交改动。本轮仅列问题，没有修改业务代码。严重度：P1 为可能误导核心判断；P2 为状态、可读性或证据层次问题。

已在本地浏览器检查首页、AI 总览、Claude、ChatGPT、Gemini 共用诊断模板、出口/DNS/CDN 三个页签、独立 WebRTC、服务状态总览及 AI 筛选、OpenAI/Claude 状态详情、Ping 视图和域名 WHOIS。其余 AI 页面按共享组件代码审查，不宣称逐一实测所有外部平台。没有主动运行付费/消耗额度的全球 Ping。

## 首页

### 1. P1：用途标签仍绕过多源判断

实测首页 `124.126.3.108` 显示 `government` 和绿色“家庭住宅 IP”，而详情页已显示住宅/教育机构/商业网络分歧。首页虽然调用 `assessQuality` 算分，类型徽标仍直接读取 Coffee 的 `isResidential`。同一地址在不同页面给出不同确定程度的结论。

位置：`src/views/home/index.tsx:115`、`:139`。

### 2. P2：首页只保留数字，没有估算状态和判断依据

`assessment.scoreStatus`、`scoreReference`、`headline` 等没有传给首页卡片；传入的只有 `score` 和原始类型。部分来源失败时仍是普通“质量分 / 比较好”，用户无法知道与完整结果有什么差异。首页不需要复制完整详情，但应保留估算和最关键分歧。

位置：`src/views/home/index.tsx:174`；`src/views/home/split-tunnel-visualizer.tsx:152`。

### 3. P1：只成功一个出口探针，也可能判成“同一出口”

首页先过滤没有数据的探针，再用 `cards.length` 决定 same/split。国内探针失败、外部成功时，仍可显示“当前看到同一条公网出口”；`cards[0]` 又被当作 `domesticCard`，可能把外部地址画到国内一侧。这是代码可触发的降级场景，本次正常网络下两探针均成功。

位置：`src/views/home/index.tsx:45`、`:96`、`:188`。

### 4. P1：出口差异被升级为“直连 / 代理 / 分流已生效”

首页直接将两探针结果画成 DIRECT / PROXY TUNNEL；出口页只要不同地址数大于一就写“分流已生效”。本次确实观测到不同出口，但这不能单凭结果证明代理机制、规则是否正确，或是否来自动态出口变化。应区分“观测到多出口”和“已验证配置生效”。

位置：`src/views/home/index.tsx:189`；`src/views/home/split-tunnel-visualizer.tsx:193`；`src/views/egress/flow-board.tsx:92`。

## AI 页面

### 5. P1：缺少代理字段仍显示绿色“无代理标记”

`adaptCoffee` 无条件写 `risk.available=true`，卡片以 VPN/Proxy/Tor/滥用字段全部为 falsy 判断“无代理标记”。最小回放只传 `{ip}`，四个字段均缺失，展示条件仍为 true。这里应保留未知，且来源应明确是 Coffee，不是多源共识。

位置：`src/views/ip/coffee.ts:124`；`src/views/ai/camp-card.tsx:49`。

### 6. P2：“属地正常”只依据是否中国大陆

美国阵营的任何非 CN 地址都会标“属地正常”；没有使用各平台支持地区名单。这最多说明定位不在中国大陆，不能证明该地区被平台支持或使用正常。

位置：`src/views/ai/camp-card.tsx:65`、`:287`。

### 7. P2：出口失败后，属性查询永久显示“检测中”

没有 IP 时 lookup query 被禁用，但 TanStack Query 无数据的 disabled query 仍为 `isPending=true`。卡片据此一直显示“查询归属… / 属性检测中…”。本次 Grok 同时显示“未确认 / 暂不可用”和这两个加载提示。

位置：`src/views/ai/use-ai-network.ts:117`；`src/views/ai/camp-card.tsx:369`。

### 8. P2：没有配置 API 出口探测，却显示“检测失败”

Claude/GPT 详情传入 `api.anthropic.com`、`api.openai.com`，但平台映射只匹配产品网站域名，API 行没有专属出口查询。表格却显示“出口暂不可用 / 检测失败”，实际状态是未配置。本次 Claude API 行一边是“检测失败”，一边显示 355 ms 的资源响应。

位置：`src/views/components/ai-diagnostics/index.tsx:149`；`src/views/ai/use-ai-network.ts:60`；`src/views/ai/network-check.tsx:73`、`:138`。

### 9. P2：延迟和阵营比较没有清楚表达采样完整度

详情三次采样只要一次成功就返回 response，median 只取成功样本；已有 failures 没在表格中直接展示。两次超时、一次成功可能仍看起来是普通延迟值。总览按 median 是否存在算“可达率”并选“领先”，把跨域限制/超时等未确认结果当成比较中的负项，排名并非稳定可用性比较。

位置：`src/views/ai/probe.ts:47`、`:60`、`:150`；`src/views/ai/network-check.tsx:149`；`src/views/ai/fleet-board.tsx:19`、`:36`。

### 10. P2：AI 总览重复展示同一组出口证据，主次不清

Gemini 和多个国内平台没有专属出口接口，会逐卡展开同一组 api.ip.sb、国内 CDN、WebRTC 地址、属性和解释。当前页面同一组三路线重复至少六次，延迟与真正的平台观测被大量重复内容淹没。Gemini 详情也在出口卡、线路观测和网络表中重复地址与限制说明。

已有提示确实说明这些不是平台专属出口，因此本项是信息组织问题，不是完全没有说明范围。

位置：`src/views/ai/camp-card.tsx:354`；`src/views/ai/index.tsx`；`src/views/ai/network-check.tsx:120`。

## Claude 环境检测

### 11. P1：环境线索被展示为风险等级，含义超出证据

当前页面实测为“Claude 中国用户检测 / 44 / 中风险”，主要贡献包括浏览器语言 +18、中文字体 +14、日期格式 +4 等。这些是环境特征，不能直接证明账号、网络或平台风控风险。界面已有“非 Claude 官方判定”的说明，展开也有边界提示，但主要视觉仍使用明确风险分档，容易被理解为真实风险测量。

位置：`src/views/claude/environment-score.tsx:86`、`:200`、`:219`；`vendor/claude-environment/signals.ts:462`。

### 12. P1：Claude 内置 WebRTC 检测会同时产生假阴性和假阳性

不支持 RTCPeerConnection、连接失败或一秒内没有候选，都返回 `no leak detected / score 0`，并通过完整性检查。另一方面，任意 ICE IP 包括私网地址会被算为 `candidate leak / score 0.5`，没有验证是否公网、是否与 HTTP 出口不同。

本轮已用最小替身复现：不支持 WebRTC 得到“no leak detected”；私网 `192.168.1.8` 得到“candidate leak”。这针对 Claude 页内的检测器，独立 `/webrtc` 页使用另一套更谨慎的实现，不能混为一谈。

位置：`vendor/claude-environment/signals.ts:382`、`:400`、`:417`；`src/views/claude/score.ts:38`。

## 服务状态

### 13. P1：未知项存在时仍显示“全部服务运行正常”

实测 `/status/?group=AI`：25 运行中 / 0 异常 / 1 未知，标题仍是“全部服务运行正常”。判定只看至少一家正常且没有已知故障，忽略未知分母；新一轮只读到部分服务时同样可触发。

位置：`src/views/status/index.tsx:218`、`:243`。

### 14. P1：HTTP 可达性被映射为服务健康，500 也可显示正常

probe-only 服务只判断 fetch 是否 fulfilled，明确将 4xx/5xx 也当作可达；然后映射 `indicator:none`，前端显示“正常运行”。影响 Copilot、豆包、智谱及多个社区/AI 端点。DeepSeek 的官方 RSS 网络或解析失败也走相同 fallback，掩盖官方状态未知。

已回放：HTTP 500 返回 `indicator:none / Doubao 服务可访问`；非法 RSS + 端点 200 返回 `indicator:none / DeepSeek 服务可访问`。收到响应可以说明到达了一个 HTTP 服务，不能等同业务健康。401 对未带凭据 API 可能合理，但同样不证明官方系统全正常。

位置：`public/worker/ai-status.js:158`、`:193`；`src/views/status/index.tsx:31`。

### 15. P1/P2：后台重试失败后，旧结果仍被展示为当前状态

状态总览按 `query.data.status` 计正常，不检查 refetch 错误；AI 卡片也保留旧出口和属性，旧数据存在时甚至不显示读取中。已用 QueryObserver 复现首次成功后刷新失败仍保留 `indicator:none`。状态详情虽有 ErrorNotice，但旧的“当前状态”未标“上次结果”。

本项是已验证的状态管理路径，非声称本次外部接口恰好发生了这类刷新失败。

位置：`src/views/status/index.tsx:197`、`:218`；`src/views/components/service-status.tsx:21`、`:37`；`src/views/ai/camp-card.tsx:281`；`src/views/ai/network-check.tsx:149`。

## DNS / CDN / 查询辅助

### 16. P1：DNS 混合来源被完整复制到两个出口分支

同一运营商 lane 同时含国内和海外来源时，`sliceLane` 对成功 lane 直接复制整条到两个树，没有按 member/sourceSamples 拆分。当前页面的 `219.141.176.11` 在国内和海外分支均显示相同 16 次。反例回放显示两树都携带两源及全量样本数，错误归因各分支的观测次数与成员。

位置：`src/views/egress/dns-lanes.ts:402`、`:430`。

### 17. P1/P2：DNS/CDN 图把分类关系画成实测路径

DNS 根据探针名称的国内/海外分组、CDN 根据 providers 中静态 path，把结果挂到另行取得的国内/海外 HTTP 出口。大部分探测没有拿到该次请求的实际出口，域名分流下不保证走图中的地址。当前 CDN 页将标为 domestic 的 Cloudflare 探测挂在国内出口下，却显示 SJC；这不证明路线错误，但说明图不能作为端到端路径证据。

DNS 标题另以 resolver 地址数大于一判“解析走到了不同出口”；同一解析器运营方的多 IP/双协议栈也满足，不能据此认定用户的网络出口不同。CDN 的“国内和海外边缘都接住了”同样依赖预设分类。

位置：`src/views/egress/dns-stage.tsx:217`、`:264`；`src/views/egress/dns-lanes.ts:378`、`:459`；`src/views/cdn/providers.ts:17`；`src/views/egress/cdn-lanes.ts:202`；`src/views/egress/cdn-stage.tsx:215`。

### 18. P2：WHOIS 历史缓存永久新鲜，却标“实时数据”

查询使用 localStorage 历史结果作为 initialData，并设置 staleTime Infinity。再次访问历史查询不会自动更新，却保留来源名称“RDAP · 注册局实时数据”，没有可见的读取时间/历史快照提示。显式再次查询可以触发刷新，但用户通常不知道当前内容已缓存。

位置：`src/views/whois/index.tsx:69`；`public/worker/whois.js:55`；`src/views/lookup/index.tsx:100`。

### 19. P2：状态详情和 WHOIS 直接展示原始枚举，中文阅读不一致

OpenAI/Claude 状态详情实测出现 All Systems Operational / operational；WHOIS 出现 REGISTRATION、LAST CHANGED、client delete prohibited 等未解释枚举，注册实体只显示 handle（本次 example.com 为 376）。应区分可读结论与原文，不必把原始数据删除。

位置：`src/views/components/service-status.tsx:41`、`:53`、`:64`；`src/views/whois/index.tsx:37`、`:40`、`:50`。

## 其他辅助结论

### 20. P2：位置仅有一个来源，也能显示“多数一致”

位置模块的 `split` 只表示是否存在第二个城市桶；页面只要 located 非零且没有 split 就显示“多数一致”。仅 Coffee 有城市、其余来源均未读到时也满足，实际不存在多数证据。应表达为单源定位或按有效覆盖显示一致程度。

位置：`src/views/ip/details.tsx:84`；`src/views/ip/model/place.ts:177`、`:209`。

### 21. P2：DNS 各解析分支对地址合法性的校验不一致

NetEase 使用公网地址校验，而 Fastly 只要求非空字符串，BrowserLeaks/Surfshark 主要按字符模式筛选。第三方返回私网、回环或畸形数字地址时，部分分支仍把它收入 DNS 出口列表。属于可构造的输入边界，非声称本次第三方响应包含非法地址。

位置：`src/views/dns-exit/api.ts:50`、`:200`。

### 22. P2：独立 WebRTC 的“STUN 分流”未区分协议族差异

不同 STUN 端点返回的地址集合只要不相同，就设 `splitTunnel=true` 并显示“检测到 STUN 分流”。两端点分别看到 IPv4/IPv6 等正常差异也能触发；该分支摘要还直接描述 UDP 与 HTTPS 不同，尽管 splitTunnel 本身只比较了 STUN 之间的集合。应分别表达端点差异、协议族和相对 HTTP 基准差异。

位置：`src/views/webrtc/api.ts:150`、`:183`；`src/views/webrtc/index.tsx:103`。

### 23. P2：Ping 摘要的指标名称与公式不一致

平均延迟实际是有数值节点的 avg 算术平均，下面却标 `WEIGHTED`；FASTEST/最小与 SLOWEST/最大取的是节点 avg 的极值，而非原始最小/最大 RTT。应说明“节点平均值的平均 / 平均最快节点”，不能暗示按样本或覆盖加权。此项是源码公式与标签比对，没有执行全球 Ping。

位置：`src/views/ping/components/ping-results.tsx:118`、`:124`、`:148`、`:171`。

## 暂不列为问题的部分

- 独立 `/webrtc` 当前实测仅提示 HTTP/UDP 出口不同并建议核对，且对没有公网候选明确不能判定安全；未发现应将这条文案改成“已泄露”的依据。
- Ping 当前入口需要手动启动，已有“Ping 失败不能单独判定被墙”和节点覆盖提示；本轮没有运行全球测量，不对实时测量准确率作结论。
- IP 场景星级已标当前浏览器范围、总览显示出口是否匹配，保留上轮修复，不再列为同类未修问题。
- 没有调用的旧 profile 组件、未挂载的首页平台摘要不算用户当前能遇到的页面问题。
- 出口页已保留探测成功的原始 IP，即使 Geo 查询未完成也构造 `{ip, source}`；不能把 Geo 未返回就等同为出口被隐藏，这条候选问题已排除（`src/views/home/split-results.tsx:96`）。
- WebRTC API 在动态出口变化时可能仅替换 baseline.ip 而保留旧 geo（`src/views/webrtc/api.ts:195`）；当前独立页未展示该基准的 geo，暂列数据一致性隐患，不作为已可见页面错误。

## 建议处理顺序

先修未知被当正常、状态可达性冒充健康、首页/AI 与多源质量结论不一致、DNS 数据错误归因；然后统一过期/部分结果状态；最后整理重复说明、默认关键依据与原始枚举翻译。用户本轮只要求列清单，以上均未执行修复。
