import { isIP } from "node:net";
import { boundedText, publicIp } from "./http.js";
import { prefixFromRdap } from "./whois.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const TIMEOUT_MS = 8_000;
const CACHE_VERSION = "v11";

const HREF = {
  ip2location: (ip) => `https://www.ip2location.io/${encodeURIComponent(ip)}`,
  ipinfo: (ip) => `https://ipinfo.io/${encodeURIComponent(ip)}`,
  ipapi: (ip) => `https://ip-api.com/#${encodeURIComponent(ip)}`,
  scamalytics: (ip) => `https://scamalytics.com/ip/${encodeURIComponent(ip)}`,
  ippure: (ip) => `https://ippure.com/?ip=${encodeURIComponent(ip)}`,
  proxycheck: (ip) => `https://proxycheck.io/v3/${encodeURIComponent(ip)}`,
};

const IPPURE_RISK = (ip) =>
  `https://api.123169.xyz/api/info/ip-risk/${encodeURIComponent(ip)}`;

const ORDER = [
  "ippure-purity",
  "scamalytics-fraud",
  "ip2location-fraud",
  "ip2location-usage",
  "ipinfo-privacy",
  "ip2location-proxy",
  "ipapi-proxy",
  "ipapi-usage",
  "proxycheck-proxy",
  "proxycheck-usage",
  "proxycheck-risk",
  "scamalytics-proxy",
  "scamalytics-usage",
];

function mentionsIp(html, ip) {
  return html.includes(ip);
}

function cleanText(value) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || text === "-" || text === "—") return undefined;
  return text;
}

function finiteNumber(value) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseCoords(text) {
  const match = cleanText(text)?.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (!match) return {};
  return { latitude: Number(match[1]), longitude: Number(match[2]) };
}

function place(source, ip, fields) {
  const city = cleanText(fields.city);
  const region = cleanText(fields.region);
  const country = cleanText(fields.country);
  if (!city && !region && !country) return null;
  const code = cleanText(fields.country_code)?.toUpperCase();
  return {
    source,
    href: HREF[source](ip),
    city,
    region,
    country,
    country_code: code && /^[A-Z]{2}$/.test(code) ? code : undefined,
    latitude: finiteNumber(fields.latitude),
    longitude: finiteNumber(fields.longitude),
  };
}

function fieldText(html, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(
    new RegExp(
      `<label[^>]*>\\s*${escaped}\\s*</label>[\\s\\S]{0,400}?<p class="ip-result">([\\s\\S]*?)</p>`,
      "i",
    ),
  );
  if (!match) return undefined;
  return cleanText(
    match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&"),
  );
}

export function placeFromIp2Location(html, ip) {
  if (typeof html !== "string" || !mentionsIp(html, ip)) return null;
  const rawCountry = fieldText(html, "Country");
  const countryMatch = rawCountry?.match(/^(.*?)(?:\((\w{2})\))?\s*$/);
  const coords = parseCoords(fieldText(html, "Coordinates"));
  return place("ip2location", ip, {
    city: fieldText(html, "City"),
    region: fieldText(html, "Region"),
    country: countryMatch?.[1]?.trim(),
    country_code: countryMatch?.[2],
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
}

export function placeFromIpinfo(html, ip) {
  if (typeof html !== "string") return null;
  const values = {};
  for (const match of html.matchAll(
    /\{"@type":"PropertyValue","name":"([^"]+)","value":"([^"]*)"\}/g,
  ))
    values[match[1]] = match[2];
  if (values["IP Address"] !== ip) return null;
  const coords = parseCoords(values.Coordinates);
  return place("ipinfo", ip, {
    city: values.City,
    region: values.Region,
    country: values.Country,
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
}

export function placeFromIpApi(payload, ip) {
  if (!payload || payload.status !== "success" || payload.query !== ip)
    return null;
  return place("ipapi", ip, {
    city: payload.city,
    region: payload.regionName,
    country: payload.country,
    country_code: payload.countryCode,
    latitude: payload.lat,
    longitude: payload.lon,
  });
}

export function placeFromProxyCheck(payload, ip) {
  if (!payload || (payload.status !== "ok" && payload.status !== "warning"))
    return null;
  const row = payload[ip];
  if (!row || typeof row !== "object") return null;
  const loc =
    row.location && typeof row.location === "object" ? row.location : {};
  return place("proxycheck", ip, {
    city: loc.city_name ?? row.city,
    region: loc.region_name ?? row.region,
    country: loc.country_name ?? row.country,
    country_code: loc.country_code ?? row.isocode,
    latitude: loc.latitude ?? row.latitude,
    longitude: loc.longitude ?? row.longitude,
  });
}

function reading(id, source, metric, value, hint, tone, ip, extra) {
  const text = value?.replace(/\s+/g, " ").trim();
  if (!text || text === "-" || text === "—") return null;
  const item = {
    id,
    source,
    metric,
    value: text,
    hint: (hint ?? "").replace(/\s+/g, " ").trim(),
    tone,
    href: HREF[source](ip),
  };
  return extra ? { ...item, ...extra } : item;
}

function highBadTone(score, good, warn) {
  if (score <= good) return "good";
  if (score < warn) return "warn";
  return "bad";
}

function highGoodTone(score, good, warn) {
  if (score >= good) return "good";
  if (score >= warn) return "warn";
  return "bad";
}

function yesNo(value) {
  if (typeof value !== "string") return undefined;
  if (/^yes$/i.test(value.trim())) return true;
  if (/^no$/i.test(value.trim())) return false;
  return undefined;
}

function ownBoolean(object, key) {
  return object &&
    Object.hasOwn(object, key) &&
    typeof object[key] === "boolean"
    ? object[key]
    : undefined;
}

function ownYesNo(object, key) {
  return object && Object.hasOwn(object, key) ? yesNo(object[key]) : undefined;
}

function knownFlags(flags) {
  return Object.values(flags).some((value) => typeof value === "boolean");
}

function flagsFromIp2LocationType(value) {
  const flags = {};
  if (!value) return flags;
  if (/^(?:no|none|not detected)$/i.test(value.trim())) {
    return {
      vpn: false,
      proxy: false,
      tor: false,
      residentialProxy: false,
      hosting: false,
    };
  }
  if (/\bVPN\b|Anonymizing VPN/i.test(value)) flags.vpn = true;
  if (/\bTOR\b|Tor/i.test(value)) flags.tor = true;
  if (/RES|residential/i.test(value)) flags.residentialProxy = true;
  if (/PUB|proxy/i.test(value) && !/not a proxy|no proxy/i.test(value))
    flags.proxy = true;
  if (/DCH|CDN|hosting|datacenter|data center/i.test(value))
    flags.hosting = true;
  return flags;
}

export function parseIp2Location(html, ip) {
  if (typeof html !== "string" || !mentionsIp(html, ip)) return [];
  const field = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = html.match(
      new RegExp(
        `<label[^>]*>\\s*${escaped}\\s*</label>[\\s\\S]{0,240}?<p class="ip-result">([^<]*)</p>`,
        "i",
      ),
    );
    return match?.[1].trim();
  };
  const items = [];
  const usage = field("Usage Type");
  const isp = field("ISP");
  const usageFlags = flagsFromIp2LocationType(usage);
  if (usage)
    items.push(
      reading(
        "ip2location-usage",
        "ip2location",
        "usage",
        usage,
        isp ?? "",
        /DCH|CDN|host/i.test(usage) ? "warn" : "neutral",
        ip,
        knownFlags(usageFlags) ? { flags: usageFlags } : undefined,
      ),
    );
  const proxy = field("Proxy Type");
  const provider = field("Provider");
  const proxyFlags = flagsFromIp2LocationType(proxy);
  if (proxy)
    items.push(
      reading(
        "ip2location-proxy",
        "ip2location",
        "proxy",
        proxy,
        provider ?? "",
        /vpn|tor|dch|pub|res/i.test(proxy) ? "warn" : "neutral",
        ip,
        knownFlags(proxyFlags) ? { flags: proxyFlags } : undefined,
      ),
    );
  const fraud = field("Fraud Score");
  if (fraud && /^\d+$/.test(fraud)) {
    const score = Number(fraud);
    items.push(
      reading(
        "ip2location-fraud",
        "ip2location",
        "fraud",
        fraud,
        "",
        highBadTone(score, 30, 70),
        ip,
      ),
    );
  }
  return items.filter(Boolean);
}

export function parseIpinfo(html, ip) {
  if (typeof html !== "string") return [];
  const values = {};
  for (const match of html.matchAll(
    /\{"@type":"PropertyValue","name":"([^"]+)","value":"([^"]*)"\}/g,
  ))
    values[match[1]] = match[2];
  if (values["IP Address"] !== ip) return [];
  const flags = {
    vpn: yesNo(values.VPN),
    proxy: yesNo(values.Proxy),
    tor: yesNo(values.Tor),
    relay: yesNo(values.Relay),
    residentialProxy: yesNo(values["Residential Proxy"]),
    hosting: yesNo(values.Hosting),
  };
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") delete flags[key];
  }
  if (!knownFlags(flags)) return [];
  const hits = [];
  if (flags.vpn) hits.push("VPN");
  if (flags.proxy) hits.push("Proxy");
  if (flags.tor) hits.push("Tor");
  if (flags.relay) hits.push("Relay");
  if (flags.residentialProxy) hits.push("Residential Proxy");
  const value = hits.length ? hits.join(" · ") : "No";
  const hint = flags.hosting ? "Hosting" : "";
  return [
    reading(
      "ipinfo-privacy",
      "ipinfo",
      "privacy",
      value,
      hint,
      flags.tor
        ? "bad"
        : hits.length
          ? "warn"
          : flags.hosting
            ? "neutral"
            : "good",
      ip,
      { flags },
    ),
  ].filter(Boolean);
}

export function parseScamalytics(html, ip) {
  if (typeof html !== "string" || !mentionsIp(html, ip)) return [];
  const items = [];
  const fraud = html.match(/Fraud Score:\s*(\d+)/i);
  if (fraud) {
    const score = Number(fraud[1]);
    items.push(
      reading(
        "scamalytics-fraud",
        "scamalytics",
        "fraud",
        String(score),
        "",
        highBadTone(score, 19, 60),
        ip,
      ),
    );
  }
  const flag = (label) => {
    const match = html.match(
      new RegExp(
        `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(Yes|No)`,
        "i",
      ),
    );
    return yesNo(match?.[1]);
  };
  const vpn = flag("Anonymizing VPN");
  const tor = flag("Tor Exit Node");
  const server = flag("Server");
  const pub = flag("Public Proxy");
  const web = flag("Web Proxy");
  const flags = {
    vpn,
    tor,
    proxy:
      pub === true || web === true
        ? true
        : pub === false && web === false
          ? false
          : undefined,
    hosting: server,
  };
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") delete flags[key];
  }
  const hits = [];
  if (flags.vpn) hits.push("VPN");
  if (flags.tor) hits.push("Tor");
  if (flags.proxy) hits.push("Proxy");
  if (knownFlags(flags))
    items.push(
      reading(
        "scamalytics-proxy",
        "scamalytics",
        "proxy",
        hits.length ? hits.join(" · ") : "No",
        flags.hosting ? "Server" : "",
        flags.tor
          ? "bad"
          : hits.length
            ? "warn"
            : flags.hosting
              ? "neutral"
              : "good",
        ip,
        { flags },
      ),
    );
  if (server === true)
    items.push(
      reading(
        "scamalytics-usage",
        "scamalytics",
        "usage",
        "Server",
        "",
        "warn",
        ip,
      ),
    );
  return items.filter(Boolean);
}

const IPAPI_FIELDS =
  "status,message,query,isp,org,as,asname,mobile,proxy,hosting,country,countryCode,regionName,city,lat,lon";

export function parseIpApi(payload, ip) {
  if (!payload || payload.status !== "success" || payload.query !== ip)
    return [];
  const items = [];
  const proxyFlags = {
    anonymous: typeof payload.proxy === "boolean" ? payload.proxy : undefined,
    hosting: typeof payload.hosting === "boolean" ? payload.hosting : undefined,
  };
  for (const [key, value] of Object.entries(proxyFlags)) {
    if (typeof value !== "boolean") delete proxyFlags[key];
  }
  if (typeof payload.proxy === "boolean")
    items.push(
      reading(
        "ipapi-proxy",
        "ipapi",
        "proxy",
        payload.proxy ? "Anonymous" : "No",
        payload.isp ?? "",
        payload.proxy ? "warn" : "good",
        ip,
        { flags: proxyFlags },
      ),
    );
  if (payload.hosting === true)
    items.push(
      reading(
        "ipapi-usage",
        "ipapi",
        "usage",
        "Data Center",
        payload.isp ?? "",
        "warn",
        ip,
        { flags: { hosting: true } },
      ),
    );
  else if (payload.mobile === true)
    items.push(
      reading(
        "ipapi-usage",
        "ipapi",
        "usage",
        "Mobile",
        payload.isp ?? "",
        "neutral",
        ip,
      ),
    );
  return items.filter(Boolean);
}

export function parseProxyCheck(payload, ip) {
  if (!payload || (payload.status !== "ok" && payload.status !== "warning"))
    return [];
  const row = payload[ip];
  if (!row || typeof row !== "object") return [];
  const det = row.detections;
  const vpn = ownBoolean(det, "vpn") ?? ownYesNo(row, "vpn");
  const proxy = ownBoolean(det, "proxy") ?? ownYesNo(row, "proxy");
  const tor = ownBoolean(det, "tor") ?? ownYesNo(row, "tor");
  const hosting =
    ownBoolean(det, "hosting") ??
    ownYesNo(row, "hosting") ??
    (/hosting|datacenter/i.test(row.type ?? "") ? true : undefined);
  const flags = { vpn, proxy, tor, hosting };
  for (const [key, value] of Object.entries(flags)) {
    if (typeof value !== "boolean") delete flags[key];
  }
  const hits = [];
  if (vpn) hits.push("VPN");
  if (proxy) hits.push("Proxy");
  if (tor) hits.push("Tor");
  const items = [];
  if (knownFlags(flags))
    items.push(
      reading(
        "proxycheck-proxy",
        "proxycheck",
        "proxy",
        hits.length ? hits.join(" · ") : "No",
        "",
        tor ? "bad" : hits.length ? "warn" : hosting ? "neutral" : "good",
        ip,
        { flags },
      ),
    );
  const usageType = row.network?.type || row.type;
  if (hosting)
    items.push(
      reading(
        "proxycheck-usage",
        "proxycheck",
        "usage",
        "Data Center",
        usageType ?? "",
        "warn",
        ip,
      ),
    );
  else if (usageType)
    items.push(
      reading(
        "proxycheck-usage",
        "proxycheck",
        "usage",
        usageType,
        "",
        "neutral",
        ip,
      ),
    );
  const risk = det && typeof det.risk === "number" ? det.risk : row.risk;
  if (typeof risk === "number" && Number.isFinite(risk)) {
    items.push(
      reading(
        "proxycheck-risk",
        "proxycheck",
        "risk",
        String(risk),
        "",
        risk >= 66 ? "bad" : risk >= 26 ? "warn" : "good",
        ip,
      ),
    );
  }
  return items.filter(Boolean);
}

/**
 * IPPure's page prints 纯净度 as 100 minus their honeypot risk_score
 * (0–59 high risk, 60–79 medium, 80–100 low).
 */
export function parseIppureRisk(payload, ip) {
  const score = payload?.data?.risk_score;
  if (
    payload?.ok !== true ||
    typeof score !== "number" ||
    !Number.isFinite(score)
  )
    return [];
  const purity = Math.round(Math.max(0, Math.min(100, 100 - score)));
  return [
    reading(
      "ippure-purity",
      "ippure",
      "purity",
      String(purity),
      "",
      highGoodTone(purity, 80, 60),
      ip,
    ),
  ].filter(Boolean);
}

async function hmacHex(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return Array.from(new Uint8Array(signature), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function fetchHtml(url) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": UA },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return null;
  }
  try {
    return await boundedText(response, 400_000);
  } catch {
    return null;
  }
}

async function fetchJson(url, headers) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  try {
    const text = await boundedText(response, 20_000);
    try {
      return { headers: response.headers, json: JSON.parse(text) };
    } catch {
      return { headers: response.headers, json: null };
    }
  } catch {
    return { headers: response.headers, json: null };
  }
}

/**
 * IPPure's SPA signs GETs with a server-issued x-k HMAC challenge.
 * Same handshake their lookup page uses; no stored product key.
 */
async function signedJson(url) {
  const headers = {
    Accept: "application/json",
    "User-Agent": UA,
    Origin: "https://ippure.com",
    Referer: "https://ippure.com/",
  };
  const first = await fetchJson(url, headers);
  if (!first) return null;
  const key = first.headers.get("x-k");
  if (!key) return first.json;
  const ts = parseInt(first.headers.get("x-t") || "", 10);
  const timestamp = Number.isFinite(ts) ? ts : Date.now();
  const token = `${timestamp}-${await hmacHex(
    ["GET", url, "", timestamp].join("-"),
    key,
  )}`;
  const second = await fetchJson(url, {
    ...headers,
    "x-k": key,
    "x-t": token,
  });
  return second?.json ?? null;
}

async function pull(name, task) {
  try {
    const result = await task();
    if (Array.isArray(result))
      return { name, items: (result ?? []).filter(Boolean), place: null };
    return {
      name,
      items: (result?.items ?? []).filter(Boolean),
      place: result?.place ?? null,
    };
  } catch {
    return { name, items: [], place: null };
  }
}

async function pullPrefix(ip) {
  try {
    const response = await fetch(
      `https://rdap.org/ip/${encodeURIComponent(ip)}`,
      {
        redirect: "follow",
        headers: {
          Accept: "application/rdap+json, application/json",
          "User-Agent": UA,
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const text = await boundedText(response, 200_000);
    return prefixFromRdap(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Public lookup pages and IPPure's lookup-page JSON, parsed into labeled
 * readings. Never averaged. IPQS stays out: the free lookup is a Cloudflare
 * / JS shell with no Worker-stable score for an arbitrary IP.
 */
export async function ipCross(value, origin) {
  const ip = publicIp(value);
  const cache = globalThis.caches?.default;
  const key = new Request(
    `${origin}/api/ip/cross/${encodeURIComponent(ip)}?${CACHE_VERSION}`,
  );
  const cached = await cache?.match(key).catch(() => undefined);
  if (cached) return cached;

  const [jobs, prefix] = await Promise.all([
    Promise.all([
      pull("ippure", async () =>
        isIP(ip) === 4
          ? { items: parseIppureRisk(await signedJson(IPPURE_RISK(ip)), ip) }
          : { items: [] },
      ),
      pull("ip2location", async () => {
        const html = await fetchHtml(HREF.ip2location(ip));
        return {
          items: parseIp2Location(html, ip),
          place: placeFromIp2Location(html, ip),
        };
      }),
      pull("ipinfo", async () => {
        const html = await fetchHtml(HREF.ipinfo(ip));
        return {
          items: parseIpinfo(html, ip),
          place: placeFromIpinfo(html, ip),
        };
      }),
      pull("ipapi", async () => {
        const href = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${IPAPI_FIELDS}`;
        const body = await fetchJson(href, {
          Accept: "application/json",
          "User-Agent": UA,
        });
        return {
          items: parseIpApi(body?.json, ip),
          place: placeFromIpApi(body?.json, ip),
        };
      }),
      pull("proxycheck", async () => {
        const body = await fetchJson(HREF.proxycheck(ip), {
          Accept: "application/json",
          "User-Agent": UA,
        });
        return {
          items: parseProxyCheck(body?.json, ip),
          place: placeFromProxyCheck(body?.json, ip),
        };
      }),
      pull("scamalytics", async () =>
        parseScamalytics(await fetchHtml(HREF.scamalytics(ip)), ip),
      ),
    ]),
    pullPrefix(ip),
  ]);

  const readings = jobs
    .flatMap((job) => job.items)
    .filter(Boolean)
    .sort((left, right) => ORDER.indexOf(left.id) - ORDER.indexOf(right.id));
  const places = jobs.map((job) => job.place).filter(Boolean);
  const unavailable = jobs
    .filter((job) => !job.items.length)
    .map((job) => job.name);

  const result = Response.json(
    {
      ip,
      checkedAt: new Date().toISOString(),
      readings,
      places,
      unavailable,
      prefix: prefix ?? null,
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
  if (readings.length) await cache?.put(key, result.clone()).catch(() => {});
  return result;
}
