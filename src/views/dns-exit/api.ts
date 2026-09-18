import { t } from "@/i18n";
import { normalizePublicIp } from "@/lib/diagnostics";
import { request } from "@/lib/network";

export const dnsSources = [
  { name: "Surfshark", host: "ipv4.surfsharkdns.com", path: "/", samples: 5 },
  {
    name: "Fastly",
    host: "u.fastly-analytics.com",
    path: "/debug_resolver",
    samples: 5,
  },
  {
    name: "BrowserLeaks DNS4",
    host: "dns4.browserleaks.net",
    path: "/",
    samples: 3,
  },
  {
    name: "BrowserLeaks DNS6",
    host: "dns6.browserleaks.net",
    path: "/",
    samples: 3,
  },
  {
    name: "NetEase",
    host: "nstool.netease.com",
    path: "/info.js",
    samples: 5,
    probe: "script",
  },
] as const;
export type DnsResolver = {
  ip: string;
  geo: string;
  country_code?: string;
};
export type DnsExitHit = DnsResolver & {
  samples: number;
  sources: string[];
  sourceSamples: Record<string, number>;
};

function isoCountry(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z]{2}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : undefined;
}

function parseFastlyEndpoint(
  info: Record<string, unknown> | undefined,
): DnsResolver | undefined {
  if (!info || typeof info.ip !== "string" || !info.ip) return;
  const country_code = isoCountry(info.cc);
  return {
    ip: info.ip,
    geo: [info.cc, info.as_name]
      .filter((v) => typeof v === "string")
      .join(" · "),
    ...(country_code ? { country_code } : {}),
  };
}

const NSTOOL_GLOBALS = [
  "ip",
  "dns",
  "ip_province",
  "ip_city",
  "ip_isp",
  "dns_province",
  "dns_city",
  "dns_isp",
  "res",
  "msg",
] as const;

function nstoolCountry(value: unknown) {
  const text = typeof value === "string" ? value : "";
  if (/香港/.test(text)) return "HK";
  if (/台湾|台灣/.test(text)) return "TW";
  if (/澳门|澳門/.test(text)) return "MO";
  return "CN";
}

function nstoolGeo(province: unknown, city: unknown, isp: unknown) {
  const parts = [province, city, isp]
    .filter(
      (value): value is string =>
        typeof value === "string" && Boolean(value.trim()),
    )
    .map((value) => value.trim());
  return [...new Set(parts)].join(" · ");
}

function nstoolEndpoint(
  ip: unknown,
  province: unknown,
  city: unknown,
  isp: unknown,
): DnsResolver | undefined {
  const normalized = normalizePublicIp(ip);
  if (!normalized) return;
  const country_code = nstoolCountry(province);
  const place = nstoolGeo(province, city, isp);
  return {
    ip: normalized.ip,
    geo: [`${country_code}`, place].filter(Boolean).join(" · "),
    country_code,
  };
}

export function parseNstoolVars(data: unknown): {
  resolvers: DnsResolver[];
  client?: DnsResolver;
} {
  if (!data || typeof data !== "object") return { resolvers: [] };
  const record = data as Record<string, unknown>;
  const resolver = nstoolEndpoint(
    record.dns,
    record.dns_province,
    record.dns_city,
    record.dns_isp,
  );
  return {
    resolvers: resolver ? [resolver] : [],
    client: nstoolEndpoint(
      record.ip,
      record.ip_province,
      record.ip_city,
      record.ip_isp,
    ),
  };
}

function snapshotGlobals(keys: readonly string[]) {
  const target = globalThis as unknown as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, target[key]]));
}

function restoreGlobals(
  keys: readonly string[],
  previous: Record<string, unknown>,
) {
  const target = globalThis as unknown as Record<string, unknown>;
  for (const key of keys) {
    try {
      target[key] = previous[key];
    } catch {
      /* nstool uses `var` on window; those bindings cannot be deleted. */
    }
  }
}

function readGlobals(keys: readonly string[]) {
  const target = globalThis as unknown as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, target[key]]));
}

async function readNstoolScript(
  source: (typeof dnsSources)[number],
  signal: AbortSignal,
) {
  if (typeof document === "undefined") throw new Error(t("未获取到 DNS 出口"));
  signal.throwIfAborted();
  const timeout = AbortSignal.timeout(12_000);
  const combined = AbortSignal.any([signal, timeout]);
  combined.throwIfAborted();
  const previous = snapshotGlobals(NSTOOL_GLOBALS);
  const token = crypto.randomUUID().replaceAll("-", "").slice(0, 10);
  const script = document.createElement("script");
  script.async = true;
  script.charset = "gbk";
  script.src = `https://${source.host}${source.path}?t=${token}`;
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let settled = false;
    const finish = (error?: unknown) => {
      if (settled) return;
      settled = true;
      combined.removeEventListener("abort", onAbort);
      script.remove();
      const vars = readGlobals(NSTOOL_GLOBALS);
      restoreGlobals(NSTOOL_GLOBALS, previous);
      if (error) reject(error);
      else resolve(vars);
    };
    const onAbort = () =>
      finish(combined.reason ?? new DOMException("已取消", "AbortError"));
    script.onload = () => finish();
    script.onerror = () => finish(new Error(t("未获取到 DNS 出口")));
    combined.addEventListener("abort", onAbort, { once: true });
    document.head.appendChild(script);
  });
}

/** Test seam: classic-script probes cannot use fetch (no CORS, HTML MIME). */
export const dnsScriptProbe = {
  read: readNstoolScript,
};

export function parseDnsResponse(source: string, data: unknown): DnsResolver[] {
  if (source === "NetEase") return parseNstoolVars(data).resolvers;
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (source === "Fastly") {
    const resolver = parseFastlyEndpoint(
      record.dns_resolver_info as Record<string, unknown> | undefined,
    );
    return resolver ? [resolver] : [];
  }
  return Object.entries(record).flatMap(([ip, value]) => {
    if (!/^[\da-fA-F:.]+$/.test(ip) || !/[.:]/.test(ip)) return [];
    if (source.startsWith("BrowserLeaks") && Array.isArray(value)) {
      const country_code = isoCountry(value[0]);
      return [
        {
          ip,
          geo: value
            .slice(1)
            .filter((v) => typeof v === "string")
            .join(" · "),
          ...(country_code ? { country_code } : {}),
        },
      ];
    }
    if (source === "Surfshark" && value && typeof value === "object") {
      const info = value as Record<string, unknown>;
      const country_code = isoCountry(info.CountryCode ?? info.country_code);
      return [
        {
          ip,
          geo: [info.Country, info.City, info.ISP]
            .filter((v) => typeof v === "string")
            .join(" · "),
          ...(country_code ? { country_code } : {}),
        },
      ];
    }
    return [];
  });
}

/** HTTP client address echoed by a DNS probe. Not a resolver. */
export function parseDnsClient(
  source: string,
  data: unknown,
): DnsResolver | undefined {
  if (source === "NetEase") return parseNstoolVars(data).client;
  if (source !== "Fastly" || !data || typeof data !== "object") return;
  return parseFastlyEndpoint(
    (data as Record<string, unknown>).client_ip_info as
      Record<string, unknown> | undefined,
  );
}

function isScriptSource(
  source: (typeof dnsSources)[number],
): source is (typeof dnsSources)[number] & { probe: "script" } {
  return "probe" in source && source.probe === "script";
}

export async function sampleDnsSource(
  source: (typeof dnsSources)[number],
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const data = isScriptSource(source)
    ? await dnsScriptProbe.read(source, signal)
    : await request<unknown>(
        `https://${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}.${source.host}${source.path}`,
        {
          signal,
          cache: "no-store",
          credentials: "omit",
        },
      );
  signal.throwIfAborted();
  const resolvers = parseDnsResponse(source.name, data);
  if (!resolvers.length) throw new Error(t("未获取到 DNS 出口"));
  return { resolvers, client: parseDnsClient(source.name, data) };
}

export async function sampleDnsExit(signal: AbortSignal) {
  return (await sampleDnsSource(dnsSources[0], signal)).resolvers[0];
}

export type DnsProgress = {
  results: DnsExitHit[];
  clients: DnsExitHit[];
  count: number;
  failed: number;
  failures: Record<string, number>;
};
export const dnsSampleCount = dnsSources.reduce(
  (total, source) => total + source.samples,
  0,
);
function cloneHits(hits: readonly DnsExitHit[]) {
  return hits.map((item) => ({
    ...item,
    sources: [...item.sources],
    sourceSamples: { ...item.sourceSamples },
  }));
}

function mergeHit(hits: DnsExitHit[], resolver: DnsResolver, source: string) {
  const found = hits.find((item) => item.ip === resolver.ip);
  if (found) {
    found.samples++;
    found.sourceSamples[source] = (found.sourceSamples[source] ?? 0) + 1;
    if (!found.country_code && resolver.country_code)
      found.country_code = resolver.country_code;
    if (resolver.geo.length > found.geo.length) found.geo = resolver.geo;
    if (!found.sources.includes(source)) found.sources.push(source);
    return;
  }
  hits.push({
    ...resolver,
    samples: 1,
    sources: [source],
    sourceSamples: { [source]: 1 },
  });
}

export async function detectDnsExits(
  signal: AbortSignal,
  onProgress: (state: DnsProgress) => void,
) {
  let state: DnsProgress = {
    results: [],
    clients: [],
    count: 0,
    failed: 0,
    failures: {},
  };
  onProgress(state);
  for (
    let round = 0;
    round < Math.max(...dnsSources.map((source) => source.samples));
    round++
  ) {
    signal.throwIfAborted();
    await Promise.all(
      dnsSources
        .filter((source) => round < source.samples)
        .map(async (source) => {
          try {
            const sample = await sampleDnsSource(source, signal);
            const results = cloneHits(state.results);
            const clients = cloneHits(state.clients);
            for (const resolver of sample.resolvers)
              mergeHit(results, resolver, source.name);
            if (sample.client) mergeHit(clients, sample.client, source.name);
            state = { ...state, results, clients };
          } catch (error) {
            if (signal.aborted) throw error;
            state = {
              ...state,
              failed: state.failed + 1,
              failures: {
                ...state.failures,
                [source.name]: (state.failures[source.name] ?? 0) + 1,
              },
            };
          }
          signal.throwIfAborted();
          state = { ...state, count: state.count + 1 };
          onProgress(state);
        }),
    );
  }
  if (!state.results.length)
    throw new Error(t("DNS 出口检测失败，可能受网络、代理或跨域限制"));
  return state;
}
