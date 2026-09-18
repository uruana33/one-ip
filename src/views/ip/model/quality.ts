import { t } from "@/i18n";
import {
  sourceCatalog,
  type CatalogSourceId,
} from "@/views/ip/model/cross-checks";
import type { CrossIntel, CrossReading } from "@/views/ip/model/cross-intel";
import {
  scoreQuality,
  type QualityScore,
} from "@/views/ip/model/quality-score";
import { parseAbuseRaw, type ScoreTone } from "@/views/ip/model/scores";
import {
  sameIp,
  type TerminalEgressReading,
} from "@/views/ip/model/terminal-egress";
import { usageConflict, usableScore } from "@/views/ip/model/verdict";
import type { CoffeeIp } from "../coffee";

export type QualityKind =
  | "public-service"
  | "high-risk"
  | "vpn-exit"
  | "residential-proxy"
  | "datacenter"
  | "mobile"
  | "residential"
  | "isp"
  | "disputed"
  | "unknown";

export type QualityBand =
  "good" | "warn" | "poor" | "disputed" | "bad" | "neutral";

export type UsageClass =
  "residential" | "isp" | "mobile" | "org" | "datacenter" | "public-service";

export type SourceReputation = {
  kind: "trust" | "fraud" | "risk" | "purity";
  raw: number;
};

export type SourceStatus = "ready" | "pending" | "unavailable" | "outbound";

export interface QualityDimension {
  id: "network" | "reputation" | "runtime" | "freshness";
  label: string;
  value: string;
  hint: string;
  tone: ScoreTone;
}

export interface SourceFact {
  label: string;
  tone: ScoreTone;
}

export type SourceHeadlineKind = "score" | "verdict" | "action";

export interface SourceHeadline {
  kind: SourceHeadlineKind;
  value: string;
  caption: string;
  tone: ScoreTone;
}

export interface SourceRow {
  label: string;
  value: string;
  tone: ScoreTone;
}

export interface SourceEvidence {
  id: CatalogSourceId;
  name: string;
  href: string;
  metric: string;
  why: string;
  status: SourceStatus;
  facts: SourceFact[];
  headline: SourceHeadline;
  rows: SourceRow[];
  tone: ScoreTone;
  vpn: boolean | null;
  proxy: boolean | null;
  hosting: boolean | null;
  usage: UsageClass | null;
  residentialProxy: boolean;
  /** IP-API `proxy` is VPN/proxy/Tor in one bit. It is not a typed VPN vote. */
  untypedAnonymous: boolean;
  tor: boolean;
  reputation: SourceReputation | null;
  extremeFraud: boolean;
  elevatedFraud: boolean;
}

export interface QualityAssessment {
  kind: QualityKind;
  kindLabel: string;
  band: QualityBand;
  bandLabel: string;
  summary: string;
  pending: boolean;
  sourcesReady: number;
  sourcesTotal: number;
  score: number | null;
  scoreReference: boolean;
  scoreBreakdown: Pick<
    QualityScore,
    | "reputation"
    | "anonymity"
    | "usage"
    | "freshness"
    | "freshnessDays"
    | "freshnessEligible"
    | "prefixRegisteredAt"
    | "cap"
    | "uncapped"
  >;
  network: QualityDimension;
  reputation: QualityDimension;
  freshness?: QualityDimension;
  runtime?: QualityDimension;
  terminalIp?: string;
  sources: SourceEvidence[];
}

const HOSTING_ORG =
  /digitalocean|amazon|\baws\b|google cloud|microsoft azure|\bazure\b|\bovh\b|hetzner|vultr|leaseweb|linode|\balibaba\b|tencent|huawei cloud/i;

function uniqueFacts(facts: SourceFact[]): SourceFact[] {
  const seen = new Set<string>();
  const items: SourceFact[] = [];
  for (const fact of facts) {
    if (!fact.label || seen.has(fact.label)) continue;
    seen.add(fact.label);
    items.push(fact);
  }
  return items;
}

function uniqueRows(rows: SourceRow[]): SourceRow[] {
  const seen = new Set<string>();
  const items: SourceRow[] = [];
  for (const row of rows) {
    const key = row.label;
    if (!row.value || seen.has(key)) continue;
    seen.add(key);
    items.push(row);
  }
  return items;
}

function yn(value: boolean) {
  return value ? t("是") : t("否");
}

function scoreHeadline(
  value: string,
  caption: string,
  polarity: "high-good" | "high-bad",
  tone: ScoreTone,
): SourceHeadline {
  return {
    kind: "score",
    value,
    caption: `${caption} · ${polarity === "high-good" ? t("越高越好") : t("越高越危险")}`,
    tone,
  };
}

function splitFlags(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  if (isNegativeAnonymity(text))
    return { vpn: false, proxy: false, tor: false, res: false };
  const parts = text.split(/\s*·\s*/);
  const known = new Set(["VPN", "Proxy", "Tor", "Relay", "Residential Proxy"]);
  if (!parts.length || parts.some((part) => !known.has(part))) return null;
  return {
    vpn: parts.includes("VPN"),
    proxy: parts.includes("Proxy") || parts.includes("Relay"),
    tor: parts.includes("Tor"),
    res: parts.includes("Residential Proxy"),
  };
}

function flagsHero(flags: NonNullable<ReturnType<typeof splitFlags>>): {
  value: string;
  tone: ScoreTone;
} {
  if (flags.res) return { value: t("住宅代理"), tone: "bad" };
  const hits = [
    flags.vpn ? "VPN" : "",
    flags.proxy ? t("代理") : "",
    flags.tor ? "Tor" : "",
  ].filter(Boolean);
  if (!hits.length) return { value: t("未检出"), tone: "good" };
  return { value: hits.join(" · "), tone: flags.tor ? "bad" : "warn" };
}

function coffeeUsageRow(
  usage: ReturnType<typeof coffeeUsage>,
  d: CoffeeIp,
): SourceRow {
  if (usage === "conflict")
    return {
      label: t("用途"),
      value: usageConflict(d).join(" · "),
      tone: "warn",
    };
  if (usage === "residential")
    return { label: t("用途"), value: t("家庭宽带"), tone: "neutral" };
  if (usage === "mobile")
    return { label: t("用途"), value: t("移动网络"), tone: "neutral" };
  if (usage === "datacenter")
    return { label: t("用途"), value: t("数据中心"), tone: "warn" };
  if (usage === "isp")
    return { label: t("用途"), value: t("ISP 网络"), tone: "neutral" };
  if (usage === "org")
    return { label: t("用途"), value: t("机构网络"), tone: "neutral" };
  if (usage === "public-service")
    return { label: t("用途"), value: t("公共服务"), tone: "neutral" };
  const raw = d.company_type?.trim() || d.asn_kind?.trim();
  return { label: t("用途"), value: raw || t("未知"), tone: "neutral" };
}

function coffeePresentation(d: CoffeeIp): {
  headline: SourceHeadline;
  rows: SourceRow[];
} {
  const trust = usableScore(d.trust_score);
  const fraud = coffeeFraud(d);
  const parsed = parseAbuseRaw(
    d.intelligence?.abuser_score_raw ?? d.abuser_score,
  );
  const usage = coffeeUsage(d);
  const vpn = tri(d.is_vpn);
  const proxy = tri(d.is_proxy);
  const tor = tri(d.is_tor);
  const trustTone: ScoreTone =
    trust == null
      ? "neutral"
      : trust >= 75
        ? "good"
        : trust >= 45
          ? "warn"
          : "bad";
  const usageRow = coffeeUsageRow(usage, d);
  const headline: SourceHeadline =
    trust != null
      ? scoreHeadline(String(trust), t("信誉分"), "high-good", trustTone)
      : {
          kind: "verdict",
          value: usageRow.value,
          caption: t("信誉与用途"),
          tone: usageRow.tone,
        };

  const hits = [
    vpn ? "VPN" : "",
    proxy ? t("代理") : "",
    tor ? "Tor" : "",
  ].filter(Boolean);
  const rows: SourceRow[] = [];
  if (parsed.score != null)
    rows.push({
      label: t("滥用"),
      value: parsed.band
        ? `${parsed.score} · ${parsed.band}`
        : String(parsed.score),
      tone: fraud.tone,
    });
  else if (d.is_abuser === true)
    rows.push({ label: t("滥用"), value: t("是"), tone: "bad" });
  rows.push(usageRow);
  rows.push({
    label: t("匿名"),
    value: hits.length
      ? hits.join(" · ")
      : vpn === false && proxy === false && tor === false
        ? t("未检出")
        : "—",
    tone: tor
      ? "bad"
      : hits.length
        ? "warn"
        : vpn === false
          ? "good"
          : "neutral",
  });
  const org = d.isp || d.asOrganization || d.asname;
  if (org)
    rows.push({
      label: t("运营商"),
      value: d.asn ? `AS${d.asn} · ${org}` : org,
      tone: "neutral",
    });
  const loc = d.countryCode || d.country;
  const reg = d.registered_country_code || d.registered_country;
  if (
    loc &&
    reg &&
    loc.replace(/\s+/g, "").toUpperCase() !==
      String(reg).replace(/\s+/g, "").toUpperCase()
  )
    rows.push({
      label: t("注册国"),
      value: t("注册于 {0}，定位在 {1}", [reg, loc]),
      tone: "warn",
    });
  return { headline, rows: uniqueRows(rows) };
}

function presentReadings(
  id: CatalogSourceId,
  metric: string,
  readings: CrossReading[],
): { headline: SourceHeadline; rows: SourceRow[] } {
  const fraud = readings.find((item) => item.metric === "fraud");
  const risk = readings.find((item) => item.metric === "risk");
  const purity = readings.find((item) => item.metric === "purity");
  const privacy = readings.find(
    (item) => item.metric === "privacy" || item.metric === "proxy",
  );
  const usage = readings.find((item) => item.metric === "usage");
  const splitSources = new Set(["ipinfo", "proxycheck", "scamalytics"]);
  const flags =
    privacy && splitSources.has(id) ? splitFlags(privacy.value) : null;
  const rows: SourceRow[] = [];
  let headline: SourceHeadline | null = null;
  let scored: CrossReading | null = null;

  if (purity) {
    scored = purity;
    headline = scoreHeadline(
      purity.value,
      t("纯净度"),
      "high-good",
      readingFraud(purity).tone,
    );
  } else if (id === "proxycheck" && risk) {
    scored = risk;
    headline = scoreHeadline(
      risk.value,
      t("风险分"),
      "high-bad",
      readingFraud(risk).tone,
    );
  } else if (fraud) {
    scored = fraud;
    headline = scoreHeadline(
      fraud.value,
      t("欺诈分"),
      "high-bad",
      readingFraud(fraud).tone,
    );
  } else if (risk) {
    scored = risk;
    headline = scoreHeadline(
      risk.value,
      t("风控值"),
      "high-bad",
      readingFraud(risk).tone,
    );
  } else if (flags) {
    const hero = flagsHero(flags);
    headline = {
      kind: "verdict",
      value: hero.value,
      caption: metric,
      tone: hero.tone,
    };
  } else if (privacy) {
    const untyped = id === "ipapi" || isUntypedAnonymousValue(privacy.value);
    headline = {
      kind: "verdict",
      value: isNegativeAnonymity(privacy.value)
        ? t("未检出")
        : untyped
          ? t("匿名出口")
          : privacy.value,
      caption: metric,
      tone: isNegativeAnonymity(privacy.value) ? "good" : "warn",
    };
  } else if (usage) {
    headline = {
      kind: "verdict",
      value: usage.value,
      caption: t("用途类型"),
      tone: classifyUsage(usage.value) === "datacenter" ? "warn" : "neutral",
    };
  } else {
    headline = {
      kind: "verdict",
      value: "—",
      caption: metric,
      tone: "neutral",
    };
  }

  if (flags && privacy) {
    rows.push({
      label: "VPN",
      value: yn(flags.vpn),
      tone: flags.vpn ? "warn" : "good",
    });
    rows.push({
      label: t("代理"),
      value: yn(flags.proxy),
      tone: flags.proxy ? "warn" : "good",
    });
    rows.push({
      label: "Tor",
      value: yn(flags.tor),
      tone: flags.tor ? "bad" : "good",
    });
    if (flags.res)
      rows.push({ label: t("住宅代理"), value: t("是"), tone: "bad" });
    if (privacy.hint === "Hosting" || privacy.hint === "Server")
      rows.push({ label: t("托管"), value: t("是"), tone: "warn" });
    else if (id === "ipinfo")
      rows.push({ label: t("托管"), value: t("否"), tone: "good" });
  } else if (privacy) {
    const value = isNegativeAnonymity(privacy.value)
      ? t("未检出")
      : id === "ipapi" || isUntypedAnonymousValue(privacy.value)
        ? t("匿名出口（未分类型）")
        : privacy.value;
    const tone: ScoreTone = isNegativeAnonymity(privacy.value)
      ? "good"
      : id === "ipapi" ||
          isUntypedAnonymousValue(privacy.value) ||
          isResidentialProxy(privacy.value)
        ? "warn"
        : classifyUsage(privacy.value) === "datacenter"
          ? "warn"
          : "neutral";
    if (!(headline.kind === "verdict" && headline.value === value))
      rows.push({
        label: id === "ip2location" ? t("代理类型") : t("匿名"),
        value,
        tone,
      });
    if (privacy.hint === "Hosting" || privacy.hint === "Server")
      rows.push({ label: t("托管"), value: t("是"), tone: "warn" });
  }

  if (usage)
    rows.push({
      label: t("用途"),
      value: usage.value,
      tone: classifyUsage(usage.value) === "datacenter" ? "warn" : "neutral",
    });

  if (fraud && fraud !== scored)
    rows.push({
      label: t("欺诈分"),
      value: fraud.value,
      tone: readingFraud(fraud).tone,
    });
  if (risk && risk !== scored)
    rows.push({
      label: id === "proxycheck" ? t("风险分") : t("风控值"),
      value: risk.value,
      tone: readingFraud(risk).tone,
    });
  if (purity && purity !== scored)
    rows.push({
      label: t("纯净度"),
      value: purity.value,
      tone: readingFraud(purity).tone,
    });

  for (const reading of readings) {
    const hint = reading.hint?.trim();
    if (!hint || /hosting|server|notserver/i.test(hint)) continue;
    rows.push({
      label:
        reading.source === "ip2location" && reading.metric === "proxy"
          ? t("供应商")
          : t("运营商"),
      value: hint,
      tone: "neutral",
    });
  }

  return { headline, rows: uniqueRows(rows) };
}

function presentOutbound(
  id: CatalogSourceId,
  metric: string,
): { headline: SourceHeadline; rows: SourceRow[] } {
  const headline: SourceHeadline = {
    kind: "action",
    value: t("去原站"),
    caption: metric,
    tone: "neutral",
  };
  if (id === "ipqs")
    return {
      headline,
      rows: [
        { label: t("欺诈分"), value: t("原站核对"), tone: "neutral" },
        { label: "VPN", value: t("原站核对"), tone: "neutral" },
        { label: t("机器人"), value: t("原站核对"), tone: "neutral" },
      ],
    };
  if (id === "abuseipdb")
    return {
      headline,
      rows: [
        { label: t("置信度"), value: t("原站核对"), tone: "neutral" },
        { label: t("举报"), value: t("原站核对"), tone: "neutral" },
      ],
    };
  return { headline, rows: [] };
}

function presentGap(status: "pending" | "unavailable"): {
  headline: SourceHeadline;
  rows: SourceRow[];
} {
  if (status === "pending")
    return {
      headline: {
        kind: "verdict",
        value: "—",
        caption: t("读取中"),
        tone: "neutral",
      },
      rows: [],
    };
  return {
    headline: {
      kind: "verdict",
      value: "—",
      caption: t("未能读取"),
      tone: "warn",
    },
    rows: [{ label: t("下一步"), value: t("去原站核对"), tone: "warn" }],
  };
}

export function factLine(facts: SourceFact[]) {
  return facts.map((item) => item.label).join(" · ");
}

function tri(value?: boolean): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function looksHosting(name?: string) {
  return !!name?.trim() && HOSTING_ORG.test(name);
}

export function classifyUsage(value?: string): UsageClass | null {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const key = text.toLowerCase();
  if (/public service|公共服务/.test(key)) return "public-service";
  if (
    /idc|dch|\bcdn\b|data\s*centre|data\s*center|datacenter|hosting|server|机房/.test(
      key,
    )
  )
    return "datacenter";
  if (/\bmob\b|mobile|蜂窝|移动/.test(key)) return "mobile";
  if (/家庭宽带|residential/.test(key)) return "residential";
  if (/\bisp\b|fixed line/.test(key)) return "isp";
  if (
    /edu|university|college|school|government|\bgov\b|business|corporate|enterprise|education/.test(
      key,
    )
  )
    return "org";
  return null;
}

function isNegativeAnonymity(value: string) {
  const key = value.toLowerCase();
  return key === "no" || key.includes("未检测");
}

function isUntypedAnonymousValue(value: string) {
  const key = value.replace(/\s+/g, " ").trim().toLowerCase();
  return (
    key === "anonymous" ||
    key === "vpn / proxy / tor" ||
    key.startsWith("匿名出口")
  );
}

function anonymity(value: string, source?: string) {
  if (isNegativeAnonymity(value))
    return {
      vpn: false as boolean | null,
      proxy: false as boolean | null,
      untyped: false,
    };
  if (source === "ipapi" || isUntypedAnonymousValue(value))
    return { vpn: null, proxy: null, untyped: true };
  const key = value.toLowerCase();
  return {
    vpn: /vpn/.test(key) as boolean | null,
    proxy: /proxy|tor/.test(key) as boolean | null,
    untyped: false,
  };
}

function isResidentialProxy(value: string) {
  return /residential proxy|\bres\b/.test(value.toLowerCase());
}

function worstTone(tones: ScoreTone[]): ScoreTone {
  if (tones.includes("bad")) return "bad";
  if (tones.includes("warn")) return "warn";
  if (tones.includes("good")) return "good";
  return "neutral";
}

function bandLabel(band: QualityBand) {
  if (band === "good") return t("比较好");
  if (band === "warn") return t("需核实");
  if (band === "poor") return t("较差");
  if (band === "disputed") return t("有争议");
  if (band === "bad") return t("明显有问题");
  return t("数据不足");
}

function kindLabel(kind: QualityKind, vpnSplit: boolean) {
  if (kind === "public-service") return t("公共服务");
  if (kind === "high-risk") return t("高风险 IP");
  if (kind === "vpn-exit") return t("VPN 出口");
  if (kind === "residential-proxy") return t("住宅代理");
  if (kind === "datacenter") return t("数据中心");
  if (kind === "mobile") return t("移动网络");
  if (kind === "residential") return t("家庭宽带");
  if (kind === "isp") return t("ISP 网络");
  if (kind === "disputed") return vpnSplit ? t("争议住宅") : t("用途有争议");
  return t("未知");
}

function coffeeUsage(d: CoffeeIp): UsageClass | "conflict" | null {
  if (d.is_public_service) return "public-service";
  if (usageConflict(d).length > 1) return "conflict";
  if (d.isResidential === true) return "residential";
  if (d.is_mobile === true) return "mobile";
  if (d.is_datacenter === true) return "datacenter";
  return classifyUsage(d.company_type) ?? classifyUsage(d.asn_kind);
}

function coffeeFacts(d: CoffeeIp): SourceFact[] {
  const facts: SourceFact[] = [];
  const trust = usableScore(d.trust_score);
  if (trust != null) {
    facts.push({
      label: t("信誉 {0}", [trust]),
      tone: trust >= 75 ? "good" : trust >= 45 ? "warn" : "bad",
    });
  }
  const fraud = coffeeFraud(d);
  const parsed = parseAbuseRaw(
    d.intelligence?.abuser_score_raw ?? d.abuser_score,
  );
  if (parsed.score != null)
    facts.push({ label: t("滥用 {0}", [parsed.score]), tone: fraud.tone });
  const usage = coffeeUsage(d);
  if (usage === "conflict") {
    for (const flag of usageConflict(d))
      facts.push({ label: flag, tone: "warn" });
  } else if (usage === "residential")
    facts.push({ label: t("家庭宽带"), tone: "neutral" });
  else if (usage === "mobile")
    facts.push({ label: t("移动网络"), tone: "neutral" });
  else if (usage === "datacenter")
    facts.push({ label: t("数据中心"), tone: "warn" });
  else if (usage === "isp")
    facts.push({ label: t("ISP 网络"), tone: "neutral" });
  else if (usage === "org")
    facts.push({ label: t("机构网络"), tone: "neutral" });
  else if (usage === "public-service")
    facts.push({ label: t("公共服务"), tone: "neutral" });
  const vpn = tri(d.is_vpn);
  const proxy = tri(d.is_proxy) === true || tri(d.is_tor) === true;
  if (vpn === false && tri(d.is_proxy) === false && tri(d.is_tor) === false)
    facts.push({ label: t("未检出 VPN / 代理 / Tor"), tone: "good" });
  else if (vpn || proxy) {
    if (vpn) facts.push({ label: "VPN", tone: "warn" });
    if (tri(d.is_proxy)) facts.push({ label: t("代理"), tone: "warn" });
    if (tri(d.is_tor)) facts.push({ label: "Tor", tone: "bad" });
  }
  if (d.isp) facts.push({ label: d.isp, tone: "neutral" });
  else if (d.asOrganization)
    facts.push({ label: d.asOrganization, tone: "neutral" });
  return uniqueFacts(facts);
}

function coffeeFraud(d: CoffeeIp) {
  const parsed = parseAbuseRaw(
    d.intelligence?.abuser_score_raw ?? d.abuser_score,
  );
  const score = parsed.score;
  const flagged = d.is_abuser === true;
  return {
    elevated: flagged || (score != null && score >= 40),
    extreme: flagged || (score != null && score >= 70),
    tone: (flagged || (score != null && score >= 70)
      ? "bad"
      : score != null && score >= 40
        ? "warn"
        : score != null
          ? "good"
          : "neutral") as ScoreTone,
  };
}

function readingFraud(reading: CrossReading) {
  const score = Number(reading.value);
  if (!Number.isFinite(score))
    return { elevated: false, extreme: false, tone: "neutral" as ScoreTone };
  if (reading.metric === "purity")
    return {
      elevated: score < 80,
      extreme: score < 60,
      tone: (score >= 80 ? "good" : score >= 60 ? "warn" : "bad") as ScoreTone,
    };
  if (reading.metric === "risk") {
    if (reading.source === "proxycheck")
      return {
        elevated: score >= 26,
        extreme: score >= 66,
        tone: (score <= 25 ? "good" : score < 66 ? "warn" : "bad") as ScoreTone,
      };
    return {
      elevated: score >= 50,
      extreme: score >= 70,
      tone: (score <= 50 ? "good" : score < 70 ? "warn" : "bad") as ScoreTone,
    };
  }
  if (reading.metric === "fraud")
    return {
      elevated: score >= 60,
      extreme: score >= 90,
      tone: (score <= 19 ? "good" : score < 60 ? "warn" : "bad") as ScoreTone,
    };
  return { elevated: false, extreme: false, tone: "neutral" as ScoreTone };
}

function factsFromReadings(readings: CrossReading[]): SourceFact[] {
  const facts: SourceFact[] = [];
  for (const reading of readings) {
    const value = reading.value.replace(/\s+/g, " ").trim();
    if (reading.metric === "fraud")
      facts.push({
        label: `${t("欺诈分")} ${value}`,
        tone: readingFraud(reading).tone,
      });
    else if (reading.metric === "risk")
      facts.push({
        label: `${reading.source === "proxycheck" ? t("风险分") : t("风控值")} ${value}`,
        tone: readingFraud(reading).tone,
      });
    else if (reading.metric === "purity")
      facts.push({
        label: `${t("纯净度")} ${value}`,
        tone: readingFraud(reading).tone,
      });
    else if (isNegativeAnonymity(value))
      facts.push({
        label:
          reading.metric === "privacy" || reading.metric === "proxy"
            ? t("未检出 VPN / 代理 / Tor")
            : t("未检测到"),
        tone: "good",
      });
    else if (
      (reading.metric === "privacy" || reading.metric === "proxy") &&
      (reading.source === "ipapi" || isUntypedAnonymousValue(value))
    ) {
      facts.push({
        label: t("匿名出口（未分类型）"),
        tone: "warn",
      });
    } else {
      const flags = anonymity(value, reading.source);
      facts.push({
        label: value,
        tone: isResidentialProxy(value)
          ? "bad"
          : flags.vpn || flags.proxy || classifyUsage(value) === "datacenter"
            ? "warn"
            : "neutral",
      });
    }
    if (reading.hint === "Hosting")
      facts.push({ label: t("托管"), tone: "warn" });
    else if (reading.hint === "Server")
      facts.push({ label: t("托管"), tone: "warn" });
    else if (reading.hint && !/hosting|server|notserver/i.test(reading.hint)) {
      const flags = anonymity(reading.value, reading.source);
      facts.push({
        label: reading.hint,
        tone:
          flags.vpn || flags.proxy || isResidentialProxy(reading.value)
            ? "warn"
            : "neutral",
      });
    }
  }
  return uniqueFacts(facts);
}

function signalsFromReadings(readings: CrossReading[]) {
  let vpn: boolean | null = null;
  let proxy: boolean | null = null;
  let hosting: boolean | null = null;
  let usage: UsageClass | null = null;
  let residentialProxy = false;
  let untypedAnonymous = false;
  let tor = false;
  let reputation: SourceEvidence["reputation"] = null;
  let extremeFraud = false;
  let elevatedFraud = false;
  const tones: ScoreTone[] = [];

  for (const reading of readings) {
    if (reading.metric === "privacy" || reading.metric === "proxy") {
      const flags = anonymity(reading.value, reading.source);
      if (flags.untyped) {
        untypedAnonymous = true;
      } else if (isNegativeAnonymity(reading.value)) {
        vpn = vpn || flags.vpn;
        if (vpn !== true) vpn = false;
        proxy = proxy || flags.proxy;
        if (proxy !== true) proxy = false;
      } else {
        if (flags.vpn) vpn = true;
        if (flags.proxy) proxy = true;
        if (vpn === null && !flags.vpn) vpn = false;
        if (proxy === null && !flags.proxy) proxy = false;
      }
      if (isResidentialProxy(reading.value)) residentialProxy = true;
      if (/tor/.test(reading.value.toLowerCase())) tor = true;
      if (/dch|host/.test(reading.value.toLowerCase())) hosting = true;
      tones.push(reading.tone);
    }
    if (reading.metric === "usage") {
      usage = classifyUsage(reading.value) ?? usage;
      if (usage === "datacenter") hosting = true;
      if (/server/i.test(reading.value) || reading.hint === "Server")
        hosting = true;
      tones.push(reading.tone);
    }
    if (reading.hint === "Hosting" || reading.hint === "Server") hosting = true;
    if (
      reading.metric === "fraud" ||
      reading.metric === "risk" ||
      reading.metric === "purity"
    ) {
      const fraud = readingFraud(reading);
      elevatedFraud ||= fraud.elevated;
      extremeFraud ||= fraud.extreme;
      tones.push(fraud.tone);
      const raw = Number(reading.value);
      if (Number.isFinite(raw)) reputation = { kind: reading.metric, raw };
    }
  }
  return {
    vpn,
    proxy,
    hosting,
    usage,
    residentialProxy,
    untypedAnonymous,
    tor,
    reputation,
    extremeFraud,
    elevatedFraud,
    tone: worstTone(tones),
  };
}

function coffeeEvidence(
  d: CoffeeIp,
  href: string,
): Omit<SourceEvidence, "metric" | "why"> {
  const usage = coffeeUsage(d);
  const fraud = coffeeFraud(d);
  const hosting =
    d.is_datacenter === true ||
    classifyUsage(d.company_type) === "datacenter" ||
    looksHosting(d.isp) ||
    looksHosting(d.asOrganization) ||
    looksHosting(d.company_name)
      ? true
      : d.is_datacenter === false
        ? false
        : null;
  const facts = coffeeFacts(d);
  const trust = usableScore(d.trust_score);
  const card = coffeePresentation(d);
  return {
    id: "coffee",
    name: "Net.Coffee",
    href,
    status: "ready",
    facts: facts.length ? facts : [{ label: t("已读取"), tone: "neutral" }],
    headline: card.headline,
    rows: card.rows,
    tone: worstTone([
      fraud.tone,
      usage === "conflict" || usage === "datacenter" ? "warn" : "neutral",
      tri(d.is_vpn) || tri(d.is_proxy) || tri(d.is_tor) ? "warn" : "good",
    ]),
    vpn: tri(d.is_vpn),
    proxy:
      tri(d.is_proxy) === true || tri(d.is_tor) === true
        ? true
        : tri(d.is_proxy),
    hosting,
    usage: usage === "conflict" ? null : usage,
    residentialProxy: false,
    untypedAnonymous: false,
    tor: d.is_tor === true,
    reputation: trust != null ? { kind: "trust", raw: trust } : null,
    extremeFraud: fraud.extreme,
    elevatedFraud: fraud.elevated,
  };
}

function outboundFacts(id: CatalogSourceId) {
  if (id === "ipqs")
    return t("请到原站查看 {0}", [
      t("Fraud Score、VPN、Proxy、Bot、Recent Abuse"),
    ]);
  if (id === "abuseipdb")
    return t("请到原站查看 {0}", [t("Abuse Confidence、Reports")]);
  return t("请到原站查看 {0}", [t("核心检测结果")]);
}

const silentSignals = {
  vpn: null as boolean | null,
  proxy: null as boolean | null,
  hosting: null as boolean | null,
  usage: null as UsageClass | null,
  residentialProxy: false,
  untypedAnonymous: false,
  tor: false,
  reputation: null as SourceEvidence["reputation"],
  extremeFraud: false,
  elevatedFraud: false,
  tone: "neutral" as ScoreTone,
};

function buildSources(
  d: CoffeeIp,
  intel: CrossIntel | null,
  pending: boolean,
): SourceEvidence[] {
  const grouped = new Map<string, CrossReading[]>();
  for (const reading of intel?.readings ?? []) {
    const list = grouped.get(reading.source) ?? [];
    list.push(reading);
    grouped.set(reading.source, list);
  }
  const unavailable = new Set<string>(intel?.unavailable ?? []);

  return sourceCatalog(d.ip).map((def) => {
    if (def.id === "coffee")
      return {
        ...coffeeEvidence(d, def.href),
        metric: def.metric,
        why: def.why,
      };

    const readings = grouped.get(def.id) ?? [];
    if (readings.length) {
      const parsed = signalsFromReadings(readings);
      const card = presentReadings(def.id, def.metric, readings);
      return {
        id: def.id,
        name: def.name,
        href: def.href,
        metric: def.metric,
        why: def.why,
        status: "ready" as const,
        facts: factsFromReadings(readings),
        headline: card.headline,
        rows: card.rows,
        ...parsed,
      };
    }
    if (!def.auto)
      return {
        id: def.id,
        name: def.name,
        href: def.href,
        metric: def.metric,
        why: def.why,
        status: "outbound" as const,
        facts: [{ label: outboundFacts(def.id), tone: "neutral" }],
        ...presentOutbound(def.id, def.metric),
        ...silentSignals,
      };
    if (pending && !intel)
      return {
        id: def.id,
        name: def.name,
        href: def.href,
        metric: def.metric,
        why: def.why,
        status: "pending" as const,
        facts: [{ label: t("正在读取…"), tone: "neutral" }],
        ...presentGap("pending"),
        ...silentSignals,
      };
    const gap = unavailable.has(def.id) || intel ? "unavailable" : "pending";
    return {
      id: def.id,
      name: def.name,
      href: def.href,
      metric: def.metric,
      why: def.why,
      status: gap,
      facts: [
        {
          label:
            gap === "unavailable"
              ? t("未能自动读取，去原站核对")
              : t("正在读取…"),
          tone: gap === "unavailable" ? "warn" : "neutral",
        },
      ],
      ...presentGap(gap),
      ...silentSignals,
    };
  });
}

function names(sources: SourceEvidence[]) {
  return sources.map((item) => item.name).join("、");
}

function buildSummary(
  kind: QualityKind,
  sources: SourceEvidence[],
  coffee: CoffeeIp,
  terminal?: TerminalEgressReading | null,
  selfLookup = false,
) {
  const vpnYes = sources.filter((item) => item.vpn === true);
  const vpnNo = sources.filter((item) => item.vpn === false);
  const untypedYes = sources.filter((item) => item.untypedAnonymous);
  const clauses: string[] = [];
  if (vpnYes.length && untypedYes.length && vpnNo.length)
    clauses.push(
      t("{0} 标 VPN，{1} 标匿名出口（未分类型），{2} 未检测到匿名", [
        names(vpnYes),
        names(untypedYes),
        names(vpnNo),
      ]),
    );
  else if (untypedYes.length && vpnNo.length)
    clauses.push(
      t("{0} 标匿名出口（未分类型），{1} 未检测到匿名", [
        names(untypedYes),
        names(vpnNo),
      ]),
    );
  else if (vpnYes.length && vpnNo.length)
    clauses.push(
      t("{0} 标 VPN，{1} 未检测到匿名", [names(vpnYes), names(vpnNo)]),
    );
  else if (vpnYes.length >= 2)
    clauses.push(t("{0} 同时标出 VPN / 代理", [names(vpnYes)]));
  else if (vpnYes.length === 1) clauses.push(t("{0} 标 VPN", [names(vpnYes)]));
  else if (untypedYes.length)
    clauses.push(t("{0} 标匿名出口（未分类型）", [names(untypedYes)]));
  else if (vpnNo.length) clauses.push(t("已读取来源未标 VPN / 代理"));

  const conflict = usageConflict(coffee);
  if (conflict.length > 1)
    clauses.push(t("Net.Coffee 同时标出 {0}", [conflict.join(" · ")]));

  for (const source of sources) {
    if (!source.extremeFraud && !source.elevatedFraud) continue;
    const hit = source.facts.find((part) =>
      /欺诈分|风控值|风险分|纯净度|滥用/.test(part.label),
    );
    if (hit) clauses.push(`${source.name} ${hit.label}`);
  }

  if (terminal?.ip) {
    if (terminal.distinctIps > 1)
      clauses.push(
        t("终端报告里出现 {0} 个出口，已采用 {1}", [
          terminal.distinctIps,
          terminal.ip,
        ]),
      );
    if (sameIp(terminal.ip, coffee.ip))
      clauses.push(t("终端出口与查询地址一致"));
    else if (selfLookup)
      clauses.push(
        t("终端出口为 {0}，与当前浏览器查询不是同一条路径", [terminal.ip]),
      );
    else clauses.push(t("终端出口为 {0}，不是当前查询地址", [terminal.ip]));
  }

  const tail =
    kind === "disputed"
      ? t("交叉验证未达成一致，不能当作普通住宅 IP。")
      : kind === "vpn-exit"
        ? t("更像匿名出口，而不是普通住宅线路。")
        : kind === "high-risk"
          ? t("信誉信号偏高，不适合当作干净住宅 IP。")
          : kind === "residential-proxy"
            ? t("命中住宅代理特征，ISP 名称不能当作普通家宽。")
            : kind === "datacenter"
              ? t("用途指向机房网络，常被风控视为非自然来源。")
              : kind === "residential"
                ? t("交叉验证偏向住宅 / ISP 网络，且未见匿名出口。")
                : kind === "isp"
                  ? t("来源只标了 ISP，不能据此当成家庭宽带。")
                  : kind === "mobile"
                    ? t("交叉验证偏向移动运营商网络。")
                    : kind === "public-service"
                      ? t("由公共服务商运营的地址，例如公共 DNS。")
                      : t("现有来源还不足以给出稳定结论。");

  const head = clauses.join(" · ");
  return head ? `${head}。${tail}` : tail;
}

function decideKind(sources: SourceEvidence[], coffee: CoffeeIp): QualityKind {
  if (coffee.is_public_service) return "public-service";

  const vpnYes = sources.filter((item) => item.vpn === true).length;
  const vpnNo = sources.filter((item) => item.vpn === false).length;
  const extreme = sources.filter((item) => item.extremeFraud).length;
  const usageVotes = sources
    .map((item) => item.usage)
    .filter((value): value is UsageClass => value != null);
  const residential = usageVotes.filter(
    (value) => value === "residential",
  ).length;
  const isp = usageVotes.filter((value) => value === "isp").length;
  const mobile = usageVotes.filter((value) => value === "mobile").length;
  const datacenter = usageVotes.filter(
    (value) => value === "datacenter",
  ).length;
  const coffeeConflict = usageConflict(coffee).length > 1;
  const usageSplit =
    coffeeConflict || (datacenter > 0 && residential + isp + mobile > 0);
  const vpnSplit = vpnYes > 0 && vpnNo > 0;
  const untypedYes = sources.filter((item) => item.untypedAnonymous).length;
  const untypedSplit = untypedYes > 0 && vpnNo > 0;

  if (
    coffee.is_abuser === true ||
    extreme >= 2 ||
    (extreme >= 1 && vpnYes >= 2)
  )
    return "high-risk";
  if (sources.some((item) => item.residentialProxy)) return "residential-proxy";
  if (vpnYes >= 2 && vpnYes > vpnNo) return "vpn-exit";
  if (vpnSplit || untypedSplit || usageSplit) return "disputed";
  if (datacenter > residential + isp + mobile) return "datacenter";
  if (mobile && mobile >= residential && mobile >= isp) return "mobile";
  if (residential && !datacenter) return "residential";
  if (isp && !datacenter && !residential) return "isp";
  if (datacenter) return "datacenter";
  return "unknown";
}

function networkDimension(
  kind: QualityKind,
  sources: SourceEvidence[],
  coffee: CoffeeIp,
): QualityDimension {
  const vpnYes = sources.filter((item) => item.vpn === true).length;
  const vpnNo = sources.filter((item) => item.vpn === false).length;
  const untypedYes = sources.filter((item) => item.untypedAnonymous).length;
  const conflict = usageConflict(coffee).length > 1;
  const org = coffee.isp || coffee.asOrganization || coffee.asname;
  let value = t("未知");
  let tone: ScoreTone = "neutral";
  if (kind === "vpn-exit" || vpnYes >= 2) {
    value = t("匿名出口");
    tone = "bad";
  } else if (
    kind === "disputed" &&
    (vpnYes > 0 || untypedYes > 0) &&
    vpnNo > 0
  ) {
    value = t("匿名检测存在分歧");
    tone = "warn";
  } else if (kind === "disputed" || conflict) {
    value = t("用途存在分歧");
    tone = "warn";
  } else if (kind === "datacenter") {
    value = t("数据中心网络");
    tone = "warn";
  } else if (kind === "mobile") {
    value = t("移动运营商网络");
    tone = "good";
  } else if (kind === "residential") {
    value = t("家庭宽带");
    tone = "good";
  } else if (kind === "isp") {
    value = t("ISP 网络");
    tone = "warn";
  } else if (kind === "public-service") {
    value = t("公共服务");
  } else if (kind === "residential-proxy") {
    value = t("住宅代理");
    tone = "bad";
  }
  const hintParts = [
    [coffee.asn ? `AS${coffee.asn}` : "", org].filter(Boolean).join(" "),
    (kind === "disputed" || kind === "isp" || kind === "residential-proxy") &&
      t("服务商名称不等于住宅 IP"),
  ].filter((part): part is string => !!part);
  return {
    id: "network",
    label: t("网络"),
    value,
    hint: hintParts.join(" · "),
    tone,
  };
}

function reputationDimension(
  sources: SourceEvidence[],
  scored: QualityScore,
): QualityDimension {
  const r = Math.round(scored.reputation);
  if (r <= 25)
    return {
      id: "reputation",
      label: t("信誉"),
      value: t("滥用风险偏高"),
      hint: t("信誉维 {0} · IPQS / AbuseIPDB 未计入", [r]),
      tone: "bad",
    };
  if (r < 60)
    return {
      id: "reputation",
      label: t("信誉"),
      value: t("信誉偏低"),
      hint: t("信誉维 {0} · IPQS / AbuseIPDB 未计入", [r]),
      tone: "warn",
    };
  if (r < 80)
    return {
      id: "reputation",
      label: t("信誉"),
      value: t("信誉一般"),
      hint: t("信誉维 {0} · IPQS / AbuseIPDB 未计入", [r]),
      tone: "warn",
    };
  if (
    sources.some(
      (item) =>
        item.status === "ready" &&
        item.facts.some((part) =>
          /欺诈分|风控值|风险分|纯净度|滥用/.test(part.label),
        ),
    )
  )
    return {
      id: "reputation",
      label: t("信誉"),
      value: t("未见明显滥用"),
      hint: t("信誉维 {0} · IPQS / AbuseIPDB 未计入", [r]),
      tone: "good",
    };
  return {
    id: "reputation",
    label: t("信誉"),
    value: t("需到原站核对欺诈分"),
    hint: t("IPQS 与 AbuseIPDB 不会被自动抓取"),
    tone: "neutral",
  };
}

function freshnessDimension(scored: QualityScore): QualityDimension {
  const days = scored.freshnessDays;
  const registered = scored.prefixRegisteredAt?.slice(0, 10);
  const age =
    days == null
      ? ""
      : days < 60
        ? t("{0} 天", [days])
        : days < 365
          ? t("{0} 个月", [Math.max(1, Math.round(days / 30.44))])
          : t("{0} 年", [Math.round(days / 365.25)]);
  const when = registered ? t("登记 {0}", [registered]) : "";

  if (days == null) {
    return {
      id: "freshness",
      label: t("网段"),
      value: t("登记日期未知"),
      hint: t("注册局没有可用的网段登记日，不加分"),
      tone: "neutral",
    };
  }

  if (scored.freshness > 0) {
    return {
      id: "freshness",
      label: t("网段"),
      value: t("较新网段 +{0}", [scored.freshness]),
      hint: [t("已登记 {0}", [age]), when, t("住宅 / ISP 网段加分")].join(
        " · ",
      ),
      tone: "good",
    };
  }

  if (days <= 730 && !scored.freshnessEligible) {
    return {
      id: "freshness",
      label: t("网段"),
      value: t("网段较新"),
      hint: [t("已登记 {0}", [age]), when, t("机房 / 代理 / 滥用不加分")].join(
        " · ",
      ),
      tone: "warn",
    };
  }

  return {
    id: "freshness",
    label: t("网段"),
    value: t("长期登记"),
    hint: [t("已登记 {0}", [age]), when, t("超过两年不加分")].join(" · "),
    tone: "neutral",
  };
}

function runtimeDimension(
  coffeeIp: string,
  terminal: TerminalEgressReading,
  selfLookup: boolean,
): QualityDimension {
  if (sameIp(terminal.ip, coffeeIp))
    return {
      id: "runtime",
      label: t("终端"),
      value: t("同一出口"),
      hint: t("本机 curl 看到的地址与查询地址相同"),
      tone: "good",
    };
  return {
    id: "runtime",
    label: t("终端"),
    value: t("不同出口"),
    hint: selfLookup
      ? t("浏览器和终端不是同一条路径，这份结论只描述当前查询地址")
      : t("终端当前出口是 {0}", [terminal.ip]),
    tone: "warn",
  };
}

/**
 * Cross-check discrete facts from sources we actually read.
 * Outbound cards stay in the table as links; they do not vote.
 * The 0–100 quality score is scoreQuality() in quality-score.ts.
 * Terminal paste is a runtime observation, not a VPN / fraud vote.
 */
export function assessQuality(
  coffee: CoffeeIp,
  intel: CrossIntel | null = null,
  options: {
    pending?: boolean;
    terminal?: TerminalEgressReading | null;
    selfLookup?: boolean;
    now?: number;
  } = {},
): QualityAssessment {
  const pending = options.pending === true && !intel;
  const sources = buildSources(coffee, intel, pending);
  const votes = sources.filter((item) => item.status === "ready");
  const kind = decideKind(votes, coffee);
  const vpnSplit =
    votes.some((item) => item.vpn === true) &&
    votes.some((item) => item.vpn === false);
  const untypedSplit =
    votes.some((item) => item.untypedAnonymous) &&
    votes.some((item) => item.vpn === false);
  const homeLike =
    votes.some(
      (item) => item.usage === "residential" || item.usage === "isp",
    ) || usageConflict(coffee).length > 1;
  const scored = scoreQuality(coffee, sources, {
    prefix: intel ? (intel.prefix ?? null) : undefined,
    now: options.now,
  });
  const band = scored.band;
  const terminal = options.terminal ?? null;
  const selfLookup = options.selfLookup === true;

  return {
    kind,
    kindLabel: kindLabel(kind, vpnSplit || untypedSplit || homeLike),
    band,
    bandLabel: bandLabel(band),
    summary: buildSummary(kind, votes, coffee, terminal, selfLookup),
    pending,
    sourcesReady: votes.length,
    sourcesTotal: sources.length,
    score: scored.value,
    scoreReference: scored.reference,
    scoreBreakdown: {
      reputation: scored.reputation,
      anonymity: scored.anonymity,
      usage: scored.usage,
      freshness: scored.freshness,
      freshnessDays: scored.freshnessDays,
      freshnessEligible: scored.freshnessEligible,
      prefixRegisteredAt: scored.prefixRegisteredAt,
      cap: scored.cap,
      uncapped: scored.uncapped,
    },
    network: networkDimension(kind, votes, coffee),
    reputation: reputationDimension(votes, scored),
    freshness: intel ? freshnessDimension(scored) : undefined,
    runtime: terminal
      ? runtimeDimension(coffee.ip, terminal, selfLookup)
      : undefined,
    terminalIp: terminal?.ip,
    sources,
  };
}
