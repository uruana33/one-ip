# 网络诊断机制优化实施方案

> 目标：在不把浏览器探测误说成“唯一真实出口”的前提下，重构网站可达性、HTTP 出口、DNS、CDN、WebRTC 和终端对照能力。
>
> 使用方式：新会话应先阅读本文，再按阶段执行。每个阶段都必须先补测试、再改实现、最后运行验收命令。不要把所有阶段合并成一个大改动。

## 1. 执行原则

1. **先修正语义，再优化实现。** 页面必须区分“观察事实”和“推断结论”。
2. **不寻找不存在的唯一出口。** HTTP、IPv4、IPv6、DNS、CDN、UDP 可能天然不同，必须分平面展示。
3. **浏览器直连和 Worker 代测不能混为一谈。** 浏览器直连反映用户浏览器路径；Worker 代测反映 Worker 到目标的路径。
4. **第三方服务只作为观测源。** 多个域名使用同一 CDN 或同一供应商时，不得计为多个独立证据。
5. **未知必须保留为未知。** CORS、opaque 响应、超时和限流不能被转换成“网站不可访问”或“检测通过”。
6. **稳定 ID 优先。** 任何 query key、缓存、React key、报告字段都不能使用翻译后的名称。
7. **固定上游，禁止开放代理。** 如需 Worker 代测，只允许编译期登记的目标，不接受用户传入任意 URL。
8. **渐进迁移。** 每个阶段保持旧页面可回退，禁止一次性删除旧结果模型和旧路由。

## 2. 当前基线

### 2.1 页面和路由

当前路由定义在 `src/App.tsx`：

| 路由                    | 当前职责                                        |
| ----------------------- | ----------------------------------------------- |
| `/network/ip`           | IP 信息查询、归属、风险和历史，不是当前出口检测 |
| `/network/connectivity` | 浏览器 HTTP 请求探测和延迟采样                  |
| `/network/exits`        | 按目标域名观察 HTTP 出口并按 IP 分组            |
| `/network/dns`          | DNS 测试服务观察到的递归解析器                  |
| `/network/cdn`          | CDN POP、响应标识和缓存头                       |
| `/network/ping`         | Globalping 等外部探针，不代表浏览器本地路径     |

已知路由问题：`src/views/home/split-results.tsx` 和 `src/views/link/index.tsx` 存在跳转 `/network/egress` 的代码，而实际路由是 `/network/exits`。第一阶段必须修复并增加路由测试。

### 2.2 规模和来源

- `src/views/link/targets.json` 当前约 66 个网站连通目标。
- `src/views/home/sites.json` 当前 50 个出口来源，其中约 45 个使用 Cloudflare Trace。
- 连通性目标中有一部分实际请求 favicon、静态资源或 CDN 域名，而不是展示名称对应的主页。
- 网站出口、DNS、CDN、WebRTC 当前使用不同返回模型，UI 各自解释状态。

### 2.3 当前关键实现

- `src/views/link/api.ts:testConnectivity()`：单站点最多 8 次顺序请求，连续两次失败提前结束。
- `src/lib/network.ts:request()`：通用 fetch 包装；`opaque` 模式不检查 HTTP 状态码。
- `src/lib/network.ts:probe()`：`no-cors` + `opaque`，只能知道网络层是否得到响应。
- `src/views/home/api.ts:getDomesticIp()`：按顺序尝试两个国内 CDN 响应头，成功一个即返回。
- `src/views/home/api.ts:getBrowserIp()`：请求 ipify，当前首页只检测 IPv4。
- `src/views/home/api.ts:detectSiteResult()`：输出 `DiagnosticResult`，但 `verified` 的含义过强。
- `src/views/dns-exit/api.ts`：对四类 DNS 测试服务进行 16 次采样，按 IP 合并。
- `src/views/cdn/index.tsx`：统一使用 trace 文本或 HEAD 响应头读取节点。
- `src/views/ai/default-exit.ts`：交叉比较 ip.sb、本站 Worker、国内 CDN 和 WebRTC/STUN。
- `src/views/home/split-tunnel-visualizer.tsx`：目前根据结果数量和位置渲染 `DIRECT`、`PROXY TUNNEL` 等结论。

### 2.4 当前误判风险

1. opaque 响应可能是 403、404、500，但页面仍可能显示请求成功。
2. 两个探测 IP 不同不能单独证明 Clash 分流、代理或“翻墙”。
3. 首页按数组位置推断国内/境外结果；一侧失败时可能把另一侧结果渲染成错误类别。
4. DNS 测试观察的是递归解析器，不是 HTTP 出口，也不能证明所有域名使用同一 DNS。
5. CDN POP 是边缘节点，不是用户出口 IP。
6. HTTP 与 WebRTC/UDP 不同可能是预期的协议分流，不一定是泄漏。
7. 多个 Cloudflare Trace 域名不能当作多个独立供应商。
8. 连接失败无法可靠细分为 DNS、TLS、CORS、超时、代理策略或站点防护。
9. `verified`、`DIRECT`、`PROXY TUNNEL`、`智能分流环境已生效` 等词容易被理解为确定性结论。

## 3. 目标结果语义

### 3.1 五类观察平面

所有页面和报告都必须明确标出观察平面：

| 平面           | 观察对象                                 | 可以说明                       | 不能说明                          |
| -------------- | ---------------------------------------- | ------------------------------ | --------------------------------- |
| HTTP 默认出口  | ipify、本站 Worker、固定 CDN 等回显服务  | 该浏览器请求到这些服务时的出口 | 所有域名的统一出口                |
| 目标 HTTP 出口 | 目标域名 trace、公开响应头或目标专用回显 | 该目标/端点看到的出口          | 目标所有子域名和 App 的出口       |
| DNS 解析器     | 随机子域名对应的测试服务                 | 测试服务观察到的递归解析器     | 所有请求的 DNS 路径、是否一定泄漏 |
| CDN 节点       | POP、边缘响应头、缓存标识                | 本次请求命中的边缘节点         | 用户公网出口、完整路由            |
| UDP/WebRTC     | STUN 观察到的公网映射                    | 浏览器 UDP 路径观察            | HTTP 路径、所有 UDP 应用          |

### 3.2 统一状态词

禁止用一个 `success` 覆盖所有情况。统一使用以下状态：

```ts
type ObservationStatus =
  | "readable_success" // CORS/同源，状态码和响应内容可验证
  | "response_observed" // opaque 响应，知道网络层收到响应，状态码不可见
  | "timeout"
  | "network_error" // 浏览器不能进一步细分时使用
  | "http_error" // 只有状态码可读时使用
  | "parse_error"
  | "rate_limited"
  | "unsupported"
  | "cancelled";
```

`response_observed` 不能在 UI 上显示为“网站正常”。推荐显示“已收到网络响应，状态不可读取”。

### 3.3 结论等级

结论只能由独立的纯函数根据观察结果生成：

| 结论                       | 条件                                          | UI 文案方向                            |
| -------------------------- | --------------------------------------------- | -------------------------------------- |
| `same_observed_exit`       | 同一轮、同一协议、至少两个独立来源返回相同 IP | 多个 HTTP 来源观察到相同出口           |
| `different_observed_exits` | 同一轮存在不同 IP，且排除了 IPv4/IPv6 混合    | 观察到不同目标出口，可能存在按域名分流 |
| `protocol_difference`      | HTTP 与 UDP 或 IPv4 与 IPv6 不同              | 不同协议/地址族使用不同路径            |
| `partial`                  | 只有一个可用来源                              | 证据不足，仅显示单一观测               |
| `unknown`                  | 没有足够有效结果                              | 无法判断                               |

禁止在没有用户声明策略的情况下显示“DNS 泄漏”“代理已生效”“一定直连”等词。

## 4. 目标架构

### 4.1 深模块和 seam

把所有网络观测收敛到一个深模块接口，页面只消费结果，不直接解析第三方响应：

```text
页面 / React Query
        |
        v
runObservation(plan, runtime) -> Observation[]
        |
        +-- transport adapter: browser fetch / Worker fixed upstream / terminal import
        +-- parser adapter: trace / JSON IP / header / opaque response / DNS / CDN / STUN
        +-- scheduler: 并发、超时、取消、预算、优先级
        +-- aggregation: 独立来源、地址族、协议、稳定性
        +-- verdict: 只根据观察事实生成有限结论
```

这里的外部 seam 是 `ObservationAdapter`；生产环境有浏览器适配器，测试使用内存适配器，终端导入使用报告适配器。不要让每个页面各自创建 fetch、超时和状态转换逻辑。

### 4.2 统一 Observation 模型

建议在 `src/lib/diagnostics.ts` 中增加类型，保留现有 `DiagnosticResult` 作为兼容层，迁移完成后再删除：

```ts
export type ObservationKind =
  | "reachability"
  | "http_default_egress"
  | "http_target_egress"
  | "dns_resolver"
  | "cdn_pop"
  | "udp_egress";

export type ObservationTransport = "https" | "dns" | "udp";

export interface Observation {
  schemaVersion: 2;
  runId: string;
  sourceId: string;
  providerFamily?: string;
  kind: ObservationKind;
  runtime: "browser" | "terminal" | "worker" | "app";
  execution: "client-request" | "worker-fixed-upstream" | "imported";
  targetHost: string;
  probeHost?: string;
  transport: ObservationTransport;
  addressFamily: 4 | 6 | "unknown";
  status: ObservationStatus;
  verified: boolean;
  attempts: number;
  successes: number;
  failures: number;
  evidence?: {
    ip?: string;
    rawIp?: string;
    httpStatus?: number;
    responseReadable?: boolean;
    resolverIp?: string;
    pop?: string;
    cacheStatus?: string;
  };
  latency?: {
    minMs?: number;
    medianMs?: number;
    maxMs?: number;
  };
  capturedAt: string;
  receivedAt: string;
  notes?: string[];
}
```

关键不变量：

- `targetHost` 是产品目标；`probeHost` 是实际请求目标，两者不同必须展示。
- `verified: true` 只表示本次请求和解析符合预期，不表示第三方数据绝对真实。
- `response_observed` 时 `evidence.httpStatus` 必须为空，`responseReadable` 为 `false`。
- DNS 结果使用 `evidence.resolverIp`，不要复用 `evidence.ip` 伪装成公网 HTTP 出口。
- CDN 结果使用 `evidence.pop` 和 `cacheStatus`，不要把 POP 写入 `ip`。
- imported 结果必须 `verified: false`，并保留报告来源和导入时间。

### 4.3 来源注册表

逐步把 `src/views/link/targets.json` 和 `src/views/home/sites.json` 收敛成带稳定 ID 的统一注册表。每个来源至少包含：

```ts
type ProbeDefinition = {
  id: string;
  productName: string;
  targetHost: string;
  probeHost: string;
  probeUrl: string;
  kind: ObservationKind;
  method: "GET" | "HEAD";
  adapter:
    | "opaque-http"
    | "readable-http"
    | "cftrace"
    | "ip-json"
    | "ip-header"
    | "dns"
    | "cdn";
  providerFamily: string;
  targetRegion: "domestic" | "global" | "unknown";
  addressFamily: "ipv4" | "ipv6" | "dual-stack" | "unknown";
  cors: "readable" | "opaque" | "unknown";
  expectedStatus?: number[];
  expectedContentType?: string[];
  enabledByDefault: boolean;
  privacyNote: string;
  lastValidatedAt?: string;
};
```

目标注册表校验规则：

- ID 唯一且与翻译无关。
- URL 必须 HTTPS，禁止凭据、片段和运行时开放主机。
- `targetHost` 和 `probeHost` 必须分别记录。
- `link-only` 不得进入自动执行集合。
- `providerFamily` 必须存在，无法确认时使用 `unknown`，不能假装独立。
- 默认来源数量有预算，新增默认来源必须有测试 fixture 和健康检查记录。
