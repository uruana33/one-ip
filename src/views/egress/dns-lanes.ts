import type { Geo } from "@/lib/types";
import {
  dnsSources,
  type DnsExitHit,
  type DnsProgress,
} from "@/views/dns-exit/api";
import type { EgressLaneKind } from "./lanes";

export type DnsFamily = "ipv4" | "ipv6";

export type DnsSourceMeta = {
  name: string;
  group: string;
  website: string;
  host: string;
  path: string;
};

export type DnsLaneSource = {
  name: string;
  samples: number;
  meta: DnsSourceMeta;
};

export type DnsLaneMember = DnsExitHit;

export type DnsLaneGroup = {
  key: string;
  label: string;
  sources: DnsLaneSource[];
  members: DnsLaneMember[];
};

export type DnsLane = {
  key: string;
  kind: EgressLaneKind;
  family?: DnsFamily;
  operator: string;
  operatorLabel: string;
  ip?: string;
  geo?: Geo;
  samples: number;
  members: DnsLaneMember[];
  sources: DnsLaneSource[];
};

const SOURCE_GROUP: Record<string, string> = {
  Surfshark: "vendor",
  Fastly: "cdn",
  "BrowserLeaks DNS4": "leak",
  "BrowserLeaks DNS6": "leak",
  NetEase: "domestic",
};

const SOURCE_WEBSITE: Record<string, string> = {
  Surfshark: "https://surfshark.com",
  Fastly: "https://www.fastly.com",
  "BrowserLeaks DNS4": "https://browserleaks.com",
  "BrowserLeaks DNS6": "https://browserleaks.com",
  NetEase: "https://nstool.netease.com",
};

export const DNS_SOURCE_GROUP_LABELS: Record<string, string> = {
  vendor: "商业探测",
  cdn: "CDN 探测",
  leak: "泄漏测试",
  domestic: "国内探测",
};

const SOURCE_GROUP_ORDER = ["domestic", "vendor", "cdn", "leak"] as const;

const OPERATORS: { key: string; label: string; pattern: RegExp }[] = [
  { key: "google", label: "Google", pattern: /google/i },
  { key: "cloudflare", label: "Cloudflare", pattern: /cloudflare/i },
  { key: "comcast", label: "Comcast", pattern: /comcast/i },
  { key: "opendns", label: "OpenDNS", pattern: /opendns|cisco/i },
  { key: "quad9", label: "Quad9", pattern: /quad9/i },
  { key: "adguard", label: "AdGuard", pattern: /adguard/i },
  { key: "nextdns", label: "NextDNS", pattern: /nextdns/i },
  { key: "controld", label: "Control D", pattern: /control\s*d/i },
  { key: "mullvad", label: "Mullvad", pattern: /mullvad/i },
  { key: "unicom", label: "中国联通", pattern: /联通|unicom|\bcnc\b/i },
  { key: "telecom", label: "中国电信", pattern: /电信|chinatelecom/i },
  { key: "cmcc", label: "中国移动", pattern: /中国移动|chinamobile|\bcmcc\b/i },
  { key: "114", label: "114DNS", pattern: /114dns/i },
  { key: "alibaba", label: "AliDNS", pattern: /alidns|alibaba|aliyun/i },
  { key: "dnspod", label: "DNSPod", pattern: /dnspod|tencent/i },
  { key: "baidu", label: "Baidu", pattern: /baidu/i },
];

export function dnsFamily(ip: string): DnsFamily {
  return ip.includes(":") ? "ipv6" : "ipv4";
}

export function dnsOperator(geo: string): { key: string; label: string } {
  const found = OPERATORS.find((item) => item.pattern.test(geo));
  if (found) return { key: found.key, label: found.label };
  const tail = geo
    .split(" · ")
    .filter(Boolean)
    .at(-1)
    ?.replace(/\s*,\s*[A-Z]{2}\s*$/, "")
    .trim();
  const label = (tail?.split(",")[0] ?? "").replace(/\s+/g, " ").trim();
  if (!label) return { key: "unknown", label: "未知运营" };
  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return { key: key || "unknown", label };
}

export function dnsSourceMeta(name: string): DnsSourceMeta {
  const source = dnsSources.find((item) => item.name === name);
  return {
    name,
    group: SOURCE_GROUP[name] ?? "other",
    website: SOURCE_WEBSITE[name] ?? `https://${source?.host ?? "example.com"}`,
    host: source?.host ?? name,
    path: source?.path ?? "/",
  };
}

export function geoFromDns(member: {
  ip: string;
  geo: string;
  country_code?: string;
}): Geo {
  const parts = member.geo
    .split(" · ")
    .map((part) => part.trim())
    .filter(Boolean);
  const cc =
    member.country_code ??
    (parts[0] && /^[A-Z]{2}$/.test(parts[0]) ? parts[0] : undefined);
  const rest = cc && parts[0] === cc ? parts.slice(1) : parts;
  const head = rest[0];
  const place = head?.split(",").map((part) => part.trim()) ?? [];
  return {
    ip: member.ip,
    country_code: cc,
    country: place[0] || rest[0],
    city: place[1],
    isp: rest.at(-1),
  };
}

function sourceHits(members: readonly DnsLaneMember[]): DnsLaneSource[] {
  const hits = new Map<string, number>();
  for (const member of members) {
    const counted = Object.entries(member.sourceSamples);
    if (counted.length) {
      for (const [name, samples] of counted) {
        hits.set(name, (hits.get(name) ?? 0) + samples);
      }
      continue;
    }
    for (const name of member.sources) {
      hits.set(name, (hits.get(name) ?? 0) + member.samples);
    }
  }
  return [...hits.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .map(([name, samples]) => ({ name, samples, meta: dnsSourceMeta(name) }));
}

function geoScore(member: DnsLaneMember) {
  const geo = member.geo;
  let score = 0;
  if (member.country_code) score += 3;
  if (/,/.test(geo)) score += 3;
  if (/United States|China|Japan|Germany|France|United Kingdom/i.test(geo))
    score += 2;
  if (/\b(Inc\.|LLC|NET)\b/i.test(geo) && !/,/.test(geo)) score -= 2;
  score += Math.min(geo.length, 40) / 40;
  return score;
}

function pickGeo(members: readonly DnsLaneMember[]): Geo | undefined {
  if (!members.length) return undefined;
  const best = [...members].sort(
    (left, right) => geoScore(right) - geoScore(left),
  )[0];
  const coded = members.find((member) => member.country_code);
  return geoFromDns({
    ...best,
    country_code: coded?.country_code ?? best.country_code,
  });
}

export function dnsLaneGroups(lane: DnsLane): DnsLaneGroup[] {
  if (lane.kind !== "exit") {
    const buckets = new Map<string, DnsLaneSource[]>();
    for (const source of lane.sources) {
      const key = source.meta.group;
      const list = buckets.get(key);
      if (list) list.push(source);
      else buckets.set(key, [source]);
    }
    return SOURCE_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
      key,
      label: DNS_SOURCE_GROUP_LABELS[key] ?? key,
      sources: buckets.get(key) ?? [],
      members: [],
    }));
  }
  return (["ipv4", "ipv6"] as const).flatMap((family) => {
    const members = lane.members.filter(
      (member) => dnsFamily(member.ip) === family,
    );
    if (!members.length) return [];
    const names = new Set(members.flatMap((member) => member.sources));
    return [
      {
        key: family,
        label: family === "ipv4" ? "IPv4" : "IPv6",
        sources: lane.sources.filter((source) => names.has(source.name)),
        members,
      },
    ];
  });
}

export function groupDnsLanes(state?: DnsProgress, busy = false): DnsLane[] {
  const results = state?.results ?? [];
  if (!results.length) {
    if (!busy) return [];
    return [
      {
        key: "pending",
        kind: "pending",
        operator: "pending",
        operatorLabel: "检测中",
        samples: 0,
        members: [],
        sources: [],
      },
    ];
  }

  const buckets = new Map<string, DnsLane>();
  for (const result of results) {
    const operator = dnsOperator(result.geo);
    const existing = buckets.get(operator.key);
    const member: DnsLaneMember = {
      ...result,
      sources: [...result.sources],
      sourceSamples: { ...result.sourceSamples },
    };
    if (existing) {
      existing.members.push(member);
      existing.samples += member.samples;
      continue;
    }
    buckets.set(operator.key, {
      key: operator.key,
      kind: "exit",
      operator: operator.key,
      operatorLabel: operator.label,
      samples: member.samples,
      members: [member],
      sources: [],
    });
  }

  const lanes = [...buckets.values()].map((lane) => {
    lane.members.sort(
      (left, right) =>
        right.samples - left.samples || left.ip.localeCompare(right.ip),
    );
    const families = new Set(
      lane.members.map((member) => dnsFamily(member.ip)),
    );
    const v4 = lane.members.filter((member) => dnsFamily(member.ip) === "ipv4");
    const v6 = lane.members.filter((member) => dnsFamily(member.ip) === "ipv6");
    const v4Samples = v4.reduce((total, member) => total + member.samples, 0);
    const v6Samples = v6.reduce((total, member) => total + member.samples, 0);
    const featured = (v4Samples >= v6Samples ? v4 : v6)[0] ?? lane.members[0];
    lane.ip = featured?.ip;
    lane.family = featured ? dnsFamily(featured.ip) : undefined;
    if (families.size === 1) lane.family = [...families][0];
    lane.geo = pickGeo(lane.members);
    if (lane.geo && lane.ip) lane.geo = { ...lane.geo, ip: lane.ip };
    lane.sources = sourceHits(lane.members);
    return lane;
  });

  lanes.sort((left, right) => right.samples - left.samples);

  const failures = Object.entries(state?.failures ?? {}).filter(
    ([, count]) => count > 0,
  );
  if (failures.length) {
    lanes.push({
      key: "blocked",
      kind: "blocked",
      operator: "blocked",
      operatorLabel: "探测受阻",
      samples: failures.reduce((total, [, count]) => total + count, 0),
      members: [],
      sources: failures.map(([name, samples]) => ({
        name,
        samples,
        meta: dnsSourceMeta(name),
      })),
    });
  }
  return lanes;
}

export function dnsGeoLabel(member: {
  ip: string;
  geo: string;
  country_code?: string;
}) {
  if (!/^[A-Z]{2} · /.test(member.geo)) return member.geo;
  const operator = dnsOperator(member.geo).label;
  const cc = member.country_code ?? member.geo.slice(0, 2);
  return `${cc} · ${operator}`;
}

export function dnsLaneFamilies(lane: DnsLane): DnsFamily[] {
  const found = new Set(lane.members.map((member) => dnsFamily(member.ip)));
  return (["ipv4", "ipv6"] as const).filter((family) => found.has(family));
}

export function dnsSourceId(laneKey: string, groupKey: string, name: string) {
  return `${laneKey}::${groupKey}::${name}`;
}

export function dnsMemberId(laneKey: string, groupKey: string, ip: string) {
  return `${laneKey}::${groupKey}::ip:${encodeURIComponent(ip)}`;
}

export function parseDnsSourceId(id: string) {
  const parsed = parseDnsLeafId(id);
  if (!parsed || parsed.kind !== "source") return undefined;
  return {
    laneKey: parsed.laneKey,
    groupKey: parsed.groupKey,
    name: parsed.name,
  };
}

export function parseDnsLeafId(id: string) {
  const [laneKey, groupKey, ...rest] = id.split("::");
  const tail = rest.join("::");
  if (!laneKey || !groupKey || !tail) return;
  if (tail.startsWith("ip:")) {
    try {
      return {
        kind: "member" as const,
        laneKey,
        groupKey,
        ip: decodeURIComponent(tail.slice(3)),
      };
    } catch {
      return;
    }
  }
  return { kind: "source" as const, laneKey, groupKey, name: tail };
}

export type DnsTreePath = "domestic" | "overseas";

export type DnsHttpExit = Geo & { path?: DnsTreePath };

export type DnsForestTree = {
  key: DnsTreePath | "all";
  origin?: DnsHttpExit;
  hint: string;
  lanes: DnsLane[];
};

export function dnsSourcePath(name: string): DnsTreePath {
  return SOURCE_GROUP[name] === "domestic" ? "domestic" : "overseas";
}

export function dnsHttpPath(geo?: DnsHttpExit): DnsTreePath {
  if (geo?.path === "domestic" || geo?.path === "overseas") return geo.path;
  if (
    geo?.country_code === "CN" ||
    geo?.country_code === "HK" ||
    geo?.country_code === "MO"
  )
    return "domestic";
  const blob = [geo?.country, geo?.isp, geo?.city, geo?.region, geo?.source]
    .filter(Boolean)
    .join(" ");
  if (
    /中国|联通|电信|移动|unicom|chinatelecom|cmcc|nstool|127\.net|byte-test/i.test(
      blob,
    )
  )
    return "domestic";
  return "overseas";
}

export function dnsLanePath(lane: DnsLane): DnsTreePath | "both" {
  if (lane.kind === "pending") return "both";
  const names =
    lane.kind === "blocked"
      ? lane.sources.map((source) => source.name)
      : [
          ...lane.members.flatMap((member) => member.sources),
          ...lane.sources.map((source) => source.name),
        ];
  const hasDomestic = names.some((name) => dnsSourcePath(name) === "domestic");
  const hasOverseas = names.some((name) => dnsSourcePath(name) === "overseas");
  if (hasDomestic && hasOverseas) return "both";
  if (hasDomestic) return "domestic";
  return "overseas";
}

function pendingLane(key: string): DnsLane {
  return {
    key,
    kind: "pending",
    operator: "pending",
    operatorLabel: "检测中",
    samples: 0,
    members: [],
    sources: [],
  };
}

function sliceLane(lane: DnsLane, path: DnsTreePath): DnsLane | undefined {
  const belongs = dnsLanePath(lane);
  if (lane.kind === "pending") return { ...lane, key: `${lane.key}:${path}` };
  if (belongs !== "both" && belongs !== path) return;
  if (lane.kind !== "blocked" || belongs !== "both") {
    return belongs === "both" ? { ...lane, key: `${lane.key}:${path}` } : lane;
  }
  const sources = lane.sources.filter(
    (source) => dnsSourcePath(source.name) === path,
  );
  if (!sources.length) return;
  return {
    ...lane,
    key: `${lane.key}:${path}`,
    sources,
    samples: sources.reduce((total, source) => total + source.samples, 0),
  };
}

function withPending(lanes: DnsLane[], path: DnsTreePath, busy: boolean) {
  if (lanes.some((lane) => lane.kind === "exit")) return lanes;
  if (busy || lanes.some((lane) => lane.kind === "pending")) {
    return lanes.some((lane) => lane.kind === "pending")
      ? lanes
      : [...lanes, pendingLane(`pending:${path}`)];
  }
  return lanes;
}

export function splitDnsForest(
  lanes: DnsLane[],
  httpExits: readonly DnsHttpExit[] = [],
  busy = false,
): DnsForestTree[] {
  const unique: DnsHttpExit[] = [];
  const seen = new Set<string>();
  for (const exit of httpExits) {
    if (!exit.ip || seen.has(exit.ip)) continue;
    seen.add(exit.ip);
    unique.push({ ...exit, path: dnsHttpPath(exit) });
  }
  const domestic = unique.find((exit) => dnsHttpPath(exit) === "domestic");
  const overseas = unique.find((exit) => exit.ip !== domestic?.ip);
  if (!domestic || !overseas) {
    return [
      {
        key: "all",
        origin: unique[0],
        hint: unique[0]?.ip ? "HTTP 出口" : "HTTP 出口待读取",
        lanes,
      },
    ];
  }
  return [
    {
      key: "domestic",
      origin: domestic,
      hint: "HTTP 出口 · 国内",
      lanes: withPending(
        lanes.flatMap((lane) => {
          const next = sliceLane(lane, "domestic");
          return next ? [next] : [];
        }),
        "domestic",
        busy,
      ),
    },
    {
      key: "overseas",
      origin: overseas,
      hint: "HTTP 出口 · 海外",
      lanes: withPending(
        lanes.flatMap((lane) => {
          const next = sliceLane(lane, "overseas");
          return next ? [next] : [];
        }),
        "overseas",
        busy,
      ),
    },
  ];
}
