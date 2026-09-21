# AI 页面属性来源复核

## 原因

`/ai/` 原先只通过 `lookupIp()` 请求 Net.Coffee。`adaptCoffee()` 又把 `geo.source` 和 `risk.source` 固定为 Net.Coffee，因此属性、风险标记和信任分都会显示单一来源。项目已有 `/api/ip/cross/:ip` 多源接口，但此前只由 IP 质量页使用。

## 处理

- AI 查询按实际出口 IP 去重读取 `lookupCross()`，共享同一 IP 的平台不会重复发起交叉查询。
- 主卡片和分流路线都接入同一套跨源属性聚合。
- 用途只合并明确的住宅、机房、移动字段；住宅与机房同时出现时保留“属性字段存在分歧”。
- VPN、代理、Tor 只合并来源实际返回的布尔字段；缺失字段保持未知，IP-API 的 `Anonymous` 只作为未分类匿名/代理证据，不拆成 VPN。
- 来源标签列出实际参与的来源，例如 Net.Coffee、IPPure、Scamalytics、IP2Location、IPinfo、IP-API、proxycheck.io。
- 交叉请求失败、读取中或没有有效 readings 时分别提示，不能把失败当成“未检测到”。
- 爬虫标记不会再被“无代理标记”掩盖。

出口探针（api.ip.sb、本站接口、国内 CDN、WebRTC）仍只表示出口观测，不会被列为 IP 属性来源。

## 验证

- 浏览器首页实测 `/ai/` 属性标签已显示 Net.Coffee 与多个交叉来源。
- AI 定向测试 15 项通过。
- 全量测试 397 项通过，TypeScript、定向 lint、生产构建和 `git diff --check` 通过。
