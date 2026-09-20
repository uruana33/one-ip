import assert from "node:assert/strict";
import { test } from "node:test";
import { assessQuality } from "../src/views/ip/model/quality.ts";

function reading(id, source, metric, value, hint = "", tone = "neutral") {
  return {
    id,
    source,
    metric,
    value,
    hint,
    tone,
    href: `https://example.test/${source}`,
    flags:
      value === "No" && (metric === "privacy" || metric === "proxy")
        ? source === "ipapi"
          ? { anonymous: false }
          : { vpn: false, proxy: false, tor: false }
        : undefined,
  };
}

test("124.126.3.108 keeps source scores but exposes residential versus institutional use", () => {
  const result = assessQuality(
    {
      ip: "124.126.3.108",
      trust_score: 97,
      abuser_score: "0.0007 (Low)",
      intelligence: { abuser_level: "low", abuser_score_raw: "0.0007 (Low)" },
      is_datacenter: false,
      isResidential: true,
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
      is_abuser: false,
      is_mobile: false,
      company_type: "government",
      company_name: "Research Institution of Telecom",
      asn_kind: "mixed",
      isp: "China Networks Inter-Exchange",
      asn: 4847,
    },
    {
      ip: "124.126.3.108",
      readings: [
        reading("ipinfo-privacy", "ipinfo", "privacy", "No", "", "good"),
        reading("ip2location-fraud", "ip2location", "fraud", "0", "", "good"),
        reading(
          "ip2location-usage",
          "ip2location",
          "usage",
          "(EDU) University/College/School",
        ),
        reading("ipapi-proxy", "ipapi", "proxy", "No", "", "good"),
        reading("scamalytics-fraud", "scamalytics", "fraud", "0", "", "good"),
        reading("ippure-purity", "ippure", "purity", "73", "", "warn"),
        reading("proxycheck-proxy", "proxycheck", "proxy", "No", "", "good"),
        reading("proxycheck-usage", "proxycheck", "usage", "Business"),
        reading("proxycheck-risk", "proxycheck", "risk", "0", "", "good"),
      ],
      unavailable: [],
    },
  );

  assert.ok(result.score != null);
  assert.equal(result.scoreBreakdown.usage, 72);
  assert.match(result.summary, /用途存在分歧/);
  assert.equal(result.band, "good");
  assert.equal(result.bandLabel, "比较好");
  assert.equal(result.kind, "disputed");
  assert.equal(result.scoreReference, false);
  assert.equal(
    result.sources.filter((item) => item.status === "outbound").length,
    2,
  );
  const ipqs = result.sources.find((item) => item.id === "ipqs");
  const abuse = result.sources.find((item) => item.id === "abuseipdb");
  assert.equal(ipqs?.status, "outbound");
  assert.equal(abuse?.status, "outbound");
});

test("Coffee abuser rates below 1 do not count as a 0–100 abuse score", () => {
  const result = assessQuality({
    ip: "203.0.113.30",
    trust_score: 97,
    abuser_score: "0.0007 (Low)",
    intelligence: { abuser_level: "low", abuser_score_raw: "0.0007 (Low)" },
    isResidential: true,
    is_datacenter: false,
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
    is_abuser: false,
  });
  assert.ok(result.score != null);
  assert.equal(result.scoreStatus, "provisional");
  assert.equal(
    result.sources.find((source) => source.id === "coffee").headline.value,
    "97",
  );
  assert.notEqual(result.scoreBreakdown.cap, 20);
});

test("public-service datacenter is not capped at 60", () => {
  const result = assessQuality({
    ip: "1.1.1.1",
    is_public_service: true,
    is_datacenter: true,
    trust_score: 90,
    isp: "Cloudflare",
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
  });
  assert.equal(result.kind, "public-service");
  assert.equal(result.scoreBreakdown.cap, 100);
  assert.ok(result.score != null);
  assert.equal(result.scoreStatus, "provisional");
  assert.equal(result.scoreReference, true);
});

test("IP-API untyped anonymity cannot trigger the VPN cap", () => {
  const result = assessQuality(
    {
      ip: "203.0.113.40",
      trust_score: 90,
      isResidential: true,
      is_datacenter: false,
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
    },
    {
      ip: "203.0.113.40",
      readings: [
        reading("ipinfo-privacy", "ipinfo", "privacy", "No", "", "good"),
        reading("ipapi-proxy", "ipapi", "proxy", "Anonymous", "", "warn"),
        reading("proxycheck-proxy", "proxycheck", "proxy", "No", "", "good"),
      ],
      unavailable: [],
    },
  );
  assert.ok(result.scoreBreakdown.cap > 40);
  assert.notEqual(result.kind, "vpn-exit");
});

const NOW = Date.parse("2026-09-18T00:00:00Z");
const FRESH_PREFIX = {
  registeredAt: "2026-08-06T06:36:23.000Z",
  cidr: "203.0.113.0/24",
};
const OLD_PREFIX = {
  registeredAt: "2010-07-14T00:00:00.000Z",
  cidr: "203.0.113.0/24",
};

function residentialIntel(ip) {
  return {
    ip,
    readings: [
      reading("ipinfo-privacy", "ipinfo", "privacy", "No", "", "good"),
      reading("ip2location-fraud", "ip2location", "fraud", "0", "", "good"),
      reading(
        "ip2location-usage",
        "ip2location",
        "usage",
        "(ISP) Fixed Line ISP",
      ),
      reading("ipapi-proxy", "ipapi", "proxy", "No", "", "good"),
      reading("scamalytics-fraud", "scamalytics", "fraud", "0", "", "good"),
      reading("ippure-purity", "ippure", "purity", "73", "", "warn"),
      reading("proxycheck-proxy", "proxycheck", "proxy", "No", "", "good"),
      reading("proxycheck-usage", "proxycheck", "usage", "Residential"),
      reading("proxycheck-risk", "proxycheck", "risk", "0", "", "good"),
    ],
    unavailable: [],
  };
}

test("registration age is context only for residential addresses", () => {
  const coffee = {
    ip: "203.0.113.80",
    trust_score: 97,
    abuser_score: "0.0007 (Low)",
    intelligence: { abuser_level: "low", abuser_score_raw: "0.0007 (Low)" },
    is_datacenter: false,
    isResidential: true,
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
    is_abuser: false,
    is_mobile: false,
  };
  const base = assessQuality(coffee, residentialIntel(coffee.ip), { now: NOW });
  const fresh = assessQuality(
    coffee,
    { ...residentialIntel(coffee.ip), prefix: FRESH_PREFIX },
    { now: NOW },
  );
  const old = assessQuality(
    coffee,
    { ...residentialIntel(coffee.ip), prefix: OLD_PREFIX },
    { now: NOW },
  );
  assert.equal(fresh.score, base.score);
  assert.equal(old.score, base.score);
  assert.doesNotMatch(fresh.freshness?.value ?? "", /\+/);
  assert.match(fresh.freshness?.hint ?? "", /不参与信誉评分/);
});

test("a recently registered datacenter prefix does not raise the score", () => {
  const result = assessQuality(
    {
      ip: "1.1.1.1",
      is_public_service: true,
      is_datacenter: true,
      trust_score: 90,
      isp: "Cloudflare",
      is_vpn: false,
      is_proxy: false,
      is_tor: false,
    },
    {
      ip: "1.1.1.1",
      readings: [],
      unavailable: [],
      prefix: FRESH_PREFIX,
    },
    { now: NOW },
  );
  assert.ok(result.score != null);
  assert.equal(result.scoreStatus, "provisional");
  assert.equal(result.scoreReference, true);
  assert.match(result.freshness?.hint ?? "", /不参与信誉评分/);
  assert.match(result.freshness?.value ?? "", /较新|Newer/);
});
