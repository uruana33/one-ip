# 124.126.3.108 的 IP 质量评估复核

> 后续状态：2026-09-19 已按本报告完成第一轮证据与结论修复。下文保留修复前的审计记录；现行规则见 [ip-quality-scoring.md](./ip-quality-scoring.md)。

复核日期：2026-09-18 至 2026-09-19（Asia/Taipei，跨午夜）。对象：本地运行页面 `http://127.0.0.1:5137/network/ip/124.126.3.108` 与当前工作区代码（含既有未提交改动）。本次只分析，未修改业务代码。

## 结论

当前证据支持“已读取来源整体风险信号较低，部分来源未检出匿名特征”，但不足以支持确定的“家庭宽带”以及“多源交叉验证偏向住宅”的表述。87 分符合当前公式，却是本站启发式指标，不能解释成安全概率、平台通过率或经过校准的综合质量。

推荐当前地址的结论文案：

> 已读取来源整体风险信号较低；网络用途存在分歧。Net.Coffee 标住宅，IP2Location 标教育机构，proxycheck.io 标 Business，暂不能确认家庭宽带。部分来源未检出 VPN/代理；IPPure 纯净度 73，仍有需要核对的风险信号。IPQS 与 AbuseIPDB 未计入。以上不代表平台可用性或账号安全。

不宜为了“修正结论”直接把 87 改成另一个主观数字；应先修复证据状态、用途分类与结论一致性。

## 项目与数据链

- 产品覆盖地址查询、AI 检测、服务状态、出口检测；技术栈为 React 19、TypeScript、Vite 8、TanStack Query、Jotai，后端为 Cloudflare Worker。本地 Vite 5137 将 `/api` 代理给 Worker 8787。
- 地址详情主数据由浏览器直接请求 Net.Coffee，经过 schema 校验、IP 地址匹配检查和适配后展示。入口：`src/views/ip/api.ts:12`、`src/views/ip/hooks/use-ip-lookup.ts:18`。
- 交叉情报经 `/api/ip/cross/:ip` 汇集第三方 HTML/JSON 与 RDAP。入口：`public/worker/ip-cross.js:610`、`src/views/ip/hooks/use-ip-cross.ts:7`。
- 前端 `quality.ts` 负责证据归一、类别、摘要与卡片；`quality-score.ts` 单独算分；`quality-board.tsx` 展示。页面组合入口：`src/views/ip/details.tsx:45`。
- 注册资料、BGP/路由、全球测量是另一些链路。当前浏览器访问平台的场景测量，也与“查询 IP 的信誉”不同；它没有参与顶部 87 分的计算。

## 实测证据

| 来源             | 当前读取结果                                                                 | 能支持什么                                             |
| ---------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Net.Coffee       | trust 97；住宅 true；机房/VPN/Proxy/Tor false；company government；ASN mixed | 该来源标为住宅，内部另含组织/ASN层信息                 |
| IPinfo           | 聚合 privacy No                                                              | 本站解析后未检出；不能仅凭聚合结果判断每一字段是否完整 |
| IP2Location      | fraud 0；用途 EDU；Research Institution of Telecom                           | 较低欺诈分、教育机构用途                               |
| IP-API           | proxy No                                                                     | 该来源的合并匿名旗标未命中                             |
| Scamalytics      | fraud 0                                                                      | 较低欺诈分；此次没有读到代理分项                       |
| IPPure           | 纯净度 73                                                                    | 本站按 100−risk_score 展示，当前以警示色呈现           |
| proxycheck.io    | risk 0；proxy No；Business                                                   | 较低风险、商业/机构用途                                |
| IPQS / AbuseIPDB | 仅外链                                                                       | 未获取证据，不参与打分                                 |

页面主结论：“87，比较好，家庭宽带”；摘要：“交叉验证偏向住宅 / ISP 网络，且未见匿名出口”。

按实际响应回放：

```text
R = 97×0.30 + 92×0.25 + 73×0.20 + 92×0.15 + 92×0.10 = 89.7
A = 92
U = 72（住宅与机构证据同时存在）
N = 0
C = 100
S = round(min(0.45×89.7 + 0.35×92 + 0.20×72 + 0, 100)) = 87
```

这里三个 92 来自本站将 Scamalytics、proxycheck、IP2Location 的低风险区间映射到固定值；不是三家原始分数。

## 发现与优先级

### P1：用途分类忽略机构证据，过度确认“家庭宽带”

位置：`src/views/ip/model/quality.ts:1136`、`:1154`、`:1171`、`:1122`。

`classifyUsage` 能识别 EDU/Business/government 为 `org`，但 `decideKind` 没有机构类别，也不把住宅与机构意见不同视为用途分歧。只要有住宅票且没有机房票，就返回 residential。实际只有 Net.Coffee 给住宅，IP2Location 与 proxycheck 给机构，却输出“交叉验证偏向住宅”。数值模型已把用途分降到 72，标题却没有体现这项分歧。

组织归属也不必然证明实际接入一定是机构专线，所以修正方向不是反向断言“绝非家宽”，而是保留归属与使用类型的层次，显示“用途存在分歧 / 家宽待核实”。建议增加企业/机构类，并让分类、分数解释共用同一组归一证据。

### P1：缺少匿名证据仍可能获得匿名维 92 分

位置：`src/views/ip/model/quality-score.ts:186`、`:215`、`:367`；`src/views/ip/model/quality.ts:907`。

匿名计算先按来源 ID 数量判断是否充足，再在没有 positive 时给 92，没有要求实际存在完整 negative 证据。Coffee 仅返回 IP 也被标成 ready；最终“参考分”仅看 ready 总数是否达到三家。

已复现：Coffee 只含 IP，交叉数据仅含 Scamalytics fraud 0、IP2Location fraud 0 和 EDU，用途/信誉以外的匿名字段全为 null，仍输出 A=92、S=89、sources=3、reference=false。

这不是当前完整响应缺少全部匿名数据的证明，而是数据降级时已验证的模型缺陷。匿名维应按检测项目的有效覆盖计算；未知不能自动变成低风险，来源总数不能代替维度证据完整度。

信誉维也有相似的覆盖问题：`quality-score.ts:150` 的加权均值只对现存信誉证据重新归一化。某一供应商可能成为信誉维唯一依据，而其他仅提供用途的 ready 来源仍能让总来源数达到三家，取消“参考分”提示。应分别统计信誉、匿名、用途的有效覆盖。

### P1：Proxy / Tor / Relay 与摘要结论脱节

位置：`src/views/ip/model/quality.ts:594`、`:1052`、`:1139`；`src/views/ip/model/quality-score.ts:203`。

类别和摘要主要数 VPN 票，而分数会处理 Proxy/Tor。将实际输入中 IPinfo 的 No 替换为下列标签，其他输入不变，得到：

| 模拟输入 | 分数 | 类别与摘要                                          |
| -------- | ---- | --------------------------------------------------- |
| Proxy    | 72   | 仍 residential，仍写“未标 VPN / 代理”“未见匿名出口” |
| Tor      | 25   | 仍 residential，仍写同样无匿名摘要                  |
| Relay    | 87   | A=92，仍 residential；中继没有进入匿名评价          |

这些是反事实回放，用来证明模型路径，不能据此称当前地址命中了 Proxy/Tor。应统一判读 VPN、Proxy、Tor、Relay、住宅代理，同时保留各类别的不同含义和风险解释。

### P1：解析层会把缺字段变成“未检出”

位置：`public/worker/ip-cross.js:244`、`:308`、`:397`。

已运行解析器最小输入验证：

- IPinfo HTML 只有匹配 IP 的 PropertyValue，没有任何隐私字段，仍返回 privacy No / good。
- proxycheck 响应只有 status ok 和 network Business，没有 detections，仍返回 proxy No / good。
- Scamalytics 文本只有 Anonymizing VPN No，其他检测项缺失，也被归并成通用 No。

前端再把通用 No 展开成 VPN、Proxy、Tor 等“否”，扩大了证据含义。HTML 改版、字段不开放和部分响应都可能因此抬高评价。应在数据结构中保留逐字段 true/false/unknown、获取失败原因和观测时间。

当前页面只获得 Worker 解析后的聚合结果，尚不能据此断言此次 IPinfo 原始页面确实缺字段。

### P2：权重、归一分与“较新网段加分”缺少校准依据

位置：`src/views/ip/model/quality-score.ts:24`、`:87`、`:102`、`:256`；`src/views/ip/model/prefix-age.ts:22`；`src/views/ip/components/quality-board.tsx:91`。

45%/35%/20%、各源权重和低风险映射 92 均由项目定义。官方可能公布原始区间，但不等于认可本站换算与混合；IP2Location 的代码注释还明确没有公开欺诈分档，UI 却统一称“按各家公开分档换算”。多家产品可能复用上游数据，也未证明七个来源是七份独立证据。

RDAP 登记日期是地址资源登记，不是当前用户取得地址时间，不足以推断更干净。实际返回的登记范围是 `124.126.0.0/15`，主档案网段是 `/24`，BGP 宣告是 `/16`，三者尺度不同。仅把登记日改为今天，其他数据不变，总分从 87 升至 95。这项加分建议移出信誉评分，作为背景信息展示。

当前地址 N=0；该规则没有额外推高本次 87 分，也没有对它直接扣 8 分。

项目设计记录也与当前方向不一致：`docs/ip-quality-sources-analysis.md:149` 和 `:220` 明确反对多源加权“总纯净度”。当前界面称“质量分”，名称虽不同，仍需说明综合指标的新增目的、校准方法与适用范围，或更新这份设计记录，避免后续开发沿两套原则演进。

### P2：场景总览容易把当前浏览器能力归到查询 IP

位置：`src/views/ip/details.tsx:257`、`src/views/ip/scenario-panel.tsx:556`、`:733`。

该地址页面的 AI 总览实测显示 Claude 5/5、ChatGPT 5/5。展开 Claude 详情，页面明确显示“出口不同”，测量出口与查询地址不一致；五星仅依据当前浏览器对公开端点的 HTTP 表现。代码已识别不同出口，并在详情说明不代表登录/对话/地区授权/账号安全，因此不能称为完全缺少防护。

但外层仍写“使用场景 / IP 条件参考”，最关键的作用范围需要点开两层才看到。建议总览直接写“当前浏览器访问表现”，把出口是否匹配放在评分旁；查询 IP 的平台支持状态应另列。此问题不影响顶部 87 分的计算。

### 补充：原生性与置信度应明确证据层次

`src/views/ip/model/verdict.ts:114` 仅比较注册国和定位国，一致即返回“原生 IP”。这只能支持“注册国与定位国一致”，不能证明实际接入形态、是否转售或是否代理。建议改为直接陈述可验证事实。`QualityAssessment` 也没有综合置信度；其他卡片中的 Coffee AI confidence 属于上游单一模型，不应被理解为本站综合判断的准确率。

## 已有合理设计

- IPQS、AbuseIPDB 没有伪造为 0 分，明确仅外链、不投票。
- IP-API 合并匿名旗标没有强行等同于确定 VPN。
- Coffee 的 0.0007 滥用读数未直接当成 0–100 百分制处理。
- 注册资料、BGP 与终端/浏览器实测有独立模块，终端贴回地址没有直接改变信誉票。
- 可展开公式及各来源原始指标，便于审计；主要缺陷在证据语义与结论一致性。

## 验证与修改顺序

已在运行页面读取主面板、公式、场景详情及 Coffee/cross/network 响应，并用实际输入回放 `assessQuality`。

执行命令：

```sh
node --import ./tests/register-paths.mjs --test tests/ip-quality-score.test.mjs tests/ip-quality.test.mjs tests/ip-cross-parse.test.mjs tests/ip-type.test.mjs
```

结果：30 项通过。尤其 `tests/ip-quality-score.test.mjs:17` 固定断言当前地址为 87 且 residential；通过表示实现符合现有断言，不能证明分类语义合理。

建议顺序：

1. 修复字段缺失与未知状态；统一匿名标签判读和摘要。
2. 补机构用途及冲突模型；对当前地址先撤掉确定的家庭宽带结论。
3. 按维度显示有效来源、分歧和数据日期；将参考状态与质量分分开。
4. 移除无依据的登记日加分，明确本站启发式评分及版本；有标注样本后再校准权重。
5. 把浏览器网络实测与任意查询 IP 的档案结论在主视图分开。

验证边界：没有该地址实际线路运营方或现场接入证据，没有平台登录/交易/对话测试，也没有本次逐一重新核对所有第三方的官方方法论。因此本报告能确认项目如何处理证据及其缺陷，不能确定该 IP 的真实最终用途或账号安全性。
