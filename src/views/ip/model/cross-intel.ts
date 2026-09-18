import { t } from "@/i18n";
import type { PrefixAge } from "./prefix-age";
import type { ScoreTone } from "./scores";

export type CrossSource =
  | "ip2location"
  | "ipinfo"
  | "ipapi"
  | "scamalytics"
  | "ipqs"
  | "ippure"
  | "proxycheck";

export interface CrossReading {
  id: string;
  source: CrossSource;
  metric:
    "risk" | "fraud" | "purity" | "usage" | "native" | "privacy" | "proxy";
  value: string;
  hint: string;
  tone: ScoreTone;
  href: string;
}

export interface CrossPlace {
  source: CrossSource;
  href: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  latitude?: number;
  longitude?: number;
}

export interface CrossIntel {
  ip: string;
  readings: CrossReading[];
  places?: CrossPlace[];
  unavailable: CrossSource[];
  prefix?: PrefixAge | null;
}

export interface DisplayScore {
  id: string;
  label: string;
  source: string;
  href?: string;
  value: string;
  hint: string;
  detail: string;
  tone: ScoreTone;
  kind: "local" | "cross";
}

const SOURCE_NAME: Record<string, string> = {
  ip2location: "IP2Location",
  ipinfo: "IPinfo",
  ipapi: "IP-API",
  scamalytics: "Scamalytics",
  ipqs: "IPQualityScore",
  ippure: "IPPure",
  proxycheck: "proxycheck.io",
};

function metricLabel(reading: CrossReading) {
  if (reading.metric === "risk")
    return reading.source === "proxycheck" ? t("风险分") : t("风控值");
  if (reading.metric === "fraud") return t("欺诈分");
  if (reading.metric === "purity") return t("纯净度");
  if (reading.metric === "native") return t("原生 IP");
  if (reading.metric === "privacy") return t("隐私检测");
  if (reading.metric === "proxy") return t("代理类型");
  return t("用途类型");
}

function displayValue(reading: CrossReading) {
  if (reading.metric === "privacy" && reading.value === "No")
    return t("未检出 VPN / 代理 / Tor");
  if (reading.metric === "proxy" && reading.value === "No")
    return t("未检出 VPN / 代理 / Tor");
  if (
    reading.source === "ipapi" &&
    reading.metric === "proxy" &&
    reading.value !== "No"
  )
    return t("匿名出口（未分类型）");
  return reading.value;
}

function displayHint(reading: CrossReading) {
  const polarity =
    reading.metric === "risk" || reading.metric === "fraud"
      ? t("越高越危险")
      : reading.metric === "purity"
        ? t("越高越好")
        : "";
  const extra = reading.hint === "Hosting" ? t("托管") : reading.hint;
  return [extra, polarity].filter(Boolean).join(" · ");
}

export function coffeeHref(ip: string) {
  return `https://ip.net.coffee/ip/${encodeURIComponent(ip)}`;
}

export function sourceName(source: string) {
  return SOURCE_NAME[source] ?? source;
}

export function displayCrossReadings(readings: CrossReading[]): DisplayScore[] {
  return readings.map((reading) => {
    const source = sourceName(reading.source);
    const label = metricLabel(reading);
    const value = displayValue(reading);
    const hint = displayHint(reading);
    return {
      id: reading.id,
      label,
      source,
      href: reading.href,
      value,
      hint,
      detail: `${source} · ${label}`,
      tone: reading.tone,
      kind: "cross",
    };
  });
}
