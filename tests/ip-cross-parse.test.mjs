import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ipCross,
  parseIp2Location,
  parseIpApi,
  parseIpinfo,
  parseIppureRisk,
  parseProxyCheck,
  parseScamalytics,
  placeFromIp2Location,
  placeFromIpApi,
  placeFromIpinfo,
  placeFromProxyCheck,
} from "../public/worker/ip-cross.js";
import { prefixFromRdap } from "../public/worker/whois.js";

const IP = "74.120.253.118";

const IP2 = `<html>74.120.253.118
<label class="mb-0">Country</label>
<p class="ip-result"><img src="flag.png">&nbsp;<a>United States of America (US)</a></p>
<label class="mb-0">Region</label>
<p class="ip-result">New York</p>
<label class="mb-0">City</label>
<p class="ip-result">New York City</p>
<label class="mb-0">Coordinates</label>
<p class="ip-result">40.71319, -74.00607</p>
<label class="mb-0">Usage Type</label>
<p class="ip-result">(ISP) Fixed Line ISP</p>
<label class="mb-0">ISP</label>
<p class="ip-result">Comcast Cable Communications</p>
<label class="mb-0">Proxy Type</label>
<p class="ip-result">(VPN) Anonymizing VPN services</p>
<label class="mb-0">Provider</label>
<p class="ip-result">WisdomISP</p>
<label class="mb-0">Fraud Score</label>
<p class="ip-result">99</p>
</html>`;

const IPINFO = `<html>{"@type":"PropertyValue","name":"IP Address","value":"74.120.253.118"}
{"@type":"PropertyValue","name":"City","value":"New York City"}
{"@type":"PropertyValue","name":"Region","value":"New York"}
{"@type":"PropertyValue","name":"Country","value":"United States"}
{"@type":"PropertyValue","name":"Coordinates","value":"40.71427, -74.00597"}
{"@type":"PropertyValue","name":"VPN","value":"No"}
{"@type":"PropertyValue","name":"Proxy","value":"No"}
{"@type":"PropertyValue","name":"Tor","value":"No"}
{"@type":"PropertyValue","name":"Hosting","value":"No"}
</html>`;

const SCAM = `74.120.253.118 Fraud Risk
Fraud Score: 0
Anonymizing VPN Yes`;

test("IP2Location HTML keeps usage, proxy type and fraud on their own polarities", () => {
  const items = parseIp2Location(IP2, IP);
  assert.equal(items.find((item) => item.metric === "fraud")?.value, "99");
  assert.equal(items.find((item) => item.metric === "fraud")?.tone, "bad");
  assert.match(
    items.find((item) => item.metric === "proxy")?.value ?? "",
    /VPN/,
  );
  assert.equal(items.find((item) => item.metric === "proxy")?.hint, "WisdomISP");
  assert.match(
    items.find((item) => item.metric === "usage")?.value ?? "",
    /ISP/,
  );
  assert.match(
    items.find((item) => item.metric === "usage")?.hint ?? "",
    /Comcast/,
  );
  const clean = parseIp2Location(
    `1.1.1.1 <label>Usage Type</label><p class="ip-result">(CDN) Content Delivery Network</p>
     <label>Proxy Type</label><p class="ip-result">-</p>
     <label>Fraud Score</label><p class="ip-result">0</p>`,
    "1.1.1.1",
  );
  assert.equal(clean.find((item) => item.metric === "fraud")?.value, "0");
  assert.equal(clean.find((item) => item.metric === "proxy"), undefined);
});

test("IP2Location / IPinfo / IP-API / proxycheck expose a comparable city", () => {
  const ip2 = placeFromIp2Location(IP2, IP);
  assert.equal(ip2?.city, "New York City");
  assert.equal(ip2?.region, "New York");
  assert.equal(ip2?.country, "United States of America");
  assert.equal(ip2?.country_code, "US");
  assert.equal(ip2?.latitude, 40.71319);
  const info = placeFromIpinfo(IPINFO, IP);
  assert.equal(info?.city, "New York City");
  assert.equal(info?.latitude, 40.71427);
  const api = placeFromIpApi(
    {
      status: "success",
      query: IP,
      country: "United States",
      countryCode: "US",
      regionName: "New York",
      city: "New York",
      lat: 40.7128,
      lon: -74.006,
    },
    IP,
  );
  assert.equal(api?.city, "New York");
  assert.equal(api?.region, "New York");
  const row = placeFromProxyCheck(
    {
      status: "ok",
      [IP]: {
        location: {
          country_name: "United States",
          country_code: "US",
          region_name: "New York",
          city_name: "New York",
          latitude: 40.7128,
          longitude: -74.006,
        },
        detections: { proxy: false, vpn: false, risk: 0 },
      },
    },
    IP,
  );
  assert.equal(row?.city, "New York");
  assert.equal(row?.country_code, "US");
});

test("IP-API JSON keeps proxy and hosting as separate votes, never a blended score", () => {
  const flagged = parseIpApi(
    {
      status: "success",
      query: IP,
      isp: "Comcast Cable Communications, LLC",
      proxy: true,
      hosting: false,
      mobile: false,
    },
    IP,
  );
  assert.equal(
    flagged.find((item) => item.metric === "proxy")?.value,
    "Anonymous",
  );
  assert.equal(flagged.find((item) => item.metric === "proxy")?.tone, "warn");
  assert.equal(
    flagged.find((item) => item.metric === "proxy")?.hint,
    "Comcast Cable Communications, LLC",
  );
  assert.equal(flagged.find((item) => item.metric === "usage"), undefined);
  const hosted = parseIpApi(
    { status: "success", query: IP, proxy: false, hosting: true, mobile: false },
    IP,
  );
  assert.equal(hosted.find((item) => item.metric === "proxy")?.value, "No");
  assert.equal(hosted.find((item) => item.metric === "usage")?.value, "Data Center");
  assert.equal(
    parseIpApi({ status: "success", query: "1.1.1.1", proxy: true }, IP).length,
    0,
  );
  assert.equal(parseIpApi({ status: "fail", message: "invalid query" }, IP).length, 0);
});

test("proxycheck.io keeps VPN, proxy, usage and risk as separate votes", () => {
  const clean = parseProxyCheck(
    {
      status: "ok",
      [IP]: {
        network: { type: "Residential" },
        detections: {
          proxy: false,
          vpn: false,
          tor: false,
          hosting: false,
          risk: 0,
        },
      },
    },
    IP,
  );
  assert.equal(clean.find((item) => item.metric === "proxy")?.value, "No");
  assert.equal(clean.find((item) => item.metric === "proxy")?.tone, "good");
  assert.equal(clean.find((item) => item.metric === "usage")?.value, "Residential");
  assert.equal(clean.find((item) => item.metric === "risk")?.value, "0");
  const flagged = parseProxyCheck(
    {
      status: "ok",
      [IP]: {
        network: { type: "Hosting" },
        detections: {
          proxy: true,
          vpn: true,
          tor: true,
          hosting: true,
          risk: 80,
        },
      },
    },
    IP,
  );
  assert.equal(
    flagged.find((item) => item.metric === "proxy")?.value,
    "VPN · Proxy · Tor",
  );
  assert.equal(flagged.find((item) => item.metric === "proxy")?.tone, "bad");
  assert.equal(flagged.find((item) => item.metric === "usage")?.value, "Data Center");
  assert.equal(flagged.find((item) => item.metric === "risk")?.value, "80");
  assert.equal(
    parseProxyCheck({ status: "ok", "1.1.1.1": { detections: { vpn: true } } }, IP)
      .length,
    0,
  );
  assert.equal(parseProxyCheck({ status: "denied", message: "limit" }, IP).length, 0);
});

test("IPinfo JSON-LD privacy flags stay attached to the queried address", () => {
  const [privacy] = parseIpinfo(IPINFO, IP);
  assert.equal(privacy.value, "No");
  assert.equal(privacy.tone, "good");
  assert.equal(parseIpinfo(IPINFO, "1.1.1.1").length, 0);
});

test("Scamalytics text reports fraud and VPN separately", () => {
  const items = parseScamalytics(SCAM, IP);
  assert.equal(items.find((item) => item.metric === "fraud")?.value, "0");
  assert.equal(items.find((item) => item.metric === "proxy")?.value, "VPN");
});

test("IPPure 纯净度 is 100 minus their honeypot risk, never Coffee trust", () => {
  const [item] = parseIppureRisk({ ok: true, data: { risk_score: 40 } }, IP);
  assert.equal(item.id, "ippure-purity");
  assert.equal(item.value, "60");
  assert.equal(item.tone, "warn");
  assert.equal(item.href, "https://ippure.com/?ip=74.120.253.118");
  assert.equal(
    parseIppureRisk({ ok: true, data: { risk_score: 1 } }, IP)[0].value,
    "99",
  );
  assert.equal(
    parseIppureRisk({ ok: true, data: { risk_score: 1 } }, IP)[0].tone,
    "good",
  );
  assert.equal(
    parseIppureRisk({ ok: true, data: { risk_score: 50 } }, IP)[0].tone,
    "bad",
  );
  assert.equal(parseIppureRisk({ ok: false, data: { risk_score: 1 } }, IP).length, 0);
  assert.equal(parseIppureRisk({ ok: true, data: {} }, IP).length, 0);
});

test("ipCross gathers whatever pages return and leaves the rest unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  globalThis.caches = undefined;
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (href.includes("ip2location.io")) return new Response(IP2);
    if (href.includes("ipinfo.io")) return new Response(IPINFO);
    if (href.includes("ip-api.com/json/"))
      return Response.json({
        status: "success",
        query: IP,
        isp: "Comcast Cable Communications, LLC",
        proxy: true,
        hosting: false,
        mobile: false,
        country: "United States",
        countryCode: "US",
        regionName: "New York",
        city: "New York",
        lat: 40.7128,
        lon: -74.006,
      });
    if (href.includes("proxycheck.io/v3/"))
      return Response.json({
        status: "ok",
        [IP]: {
          network: { type: "Residential" },
          location: {
            country_name: "United States",
            country_code: "US",
            region_name: "New York",
            city_name: "New York",
            latitude: 40.7128,
            longitude: -74.006,
          },
          detections: {
            proxy: false,
            vpn: false,
            tor: false,
            hosting: false,
            risk: 0,
          },
        },
      });
    if (href.includes("scamalytics")) return new Response("blocked", { status: 403 });
    if (href.includes("rdap.org/ip/"))
      return Response.json({
        handle: "NET-74-120-252-0-3",
        startAddress: "74.120.252.0",
        endAddress: "74.120.255.255",
        cidr0_cidrs: [{ v4prefix: "74.120.252.0", length: 22 }],
        events: [
          { eventAction: "last changed", eventDate: "2026-08-06T02:36:23-04:00" },
          { eventAction: "registration", eventDate: "2026-08-06T02:36:23-04:00" },
        ],
      });
    if (href.includes("api.123169.xyz/api/info/ip-risk/")) {
      const headers = new Headers(init?.headers);
      if (headers.get("x-k")) {
        return Response.json({ ok: true, data: { risk_score: 40 } });
      }
      return new Response(JSON.stringify({ ok: false }), {
        headers: { "x-k": "test-key", "x-t": "1000", "content-type": "application/json" },
      });
    }
    throw new Error(href);
  };
  try {
    const payload = await (await ipCross(IP, "https://tools.example.com")).json();
    assert.equal(payload.ip, IP);
    assert.ok(payload.readings.some((item) => item.id === "ippure-purity"));
    assert.equal(
      payload.readings.find((item) => item.id === "ippure-purity")?.value,
      "60",
    );
    assert.ok(payload.readings.some((item) => item.id === "ip2location-fraud"));
    assert.ok(payload.readings.some((item) => item.id === "ipinfo-privacy"));
    assert.ok(payload.readings.some((item) => item.id === "ipapi-proxy"));
    assert.equal(
      payload.readings.find((item) => item.id === "ipapi-proxy")?.value,
      "Anonymous",
    );
    assert.ok(payload.readings.some((item) => item.id === "proxycheck-proxy"));
    assert.equal(
      payload.readings.find((item) => item.id === "proxycheck-proxy")?.value,
      "No",
    );
    assert.equal(payload.places.length, 4);
    assert.deepEqual(
      payload.places.map((item) => item.source).sort(),
      ["ip2location", "ipapi", "ipinfo", "proxycheck"],
    );
    assert.ok(payload.places.every((item) => /new york/i.test(item.city)));
    assert.ok(payload.unavailable.includes("scamalytics"));
    assert.ok(!payload.unavailable.includes("ippure"));
    assert.ok(!payload.readings.some((item) => item.source === "scamalytics"));
    assert.ok(!payload.readings.some((item) => item.source === "ipqs"));
    assert.equal(payload.prefix?.cidr, "74.120.252.0/22");
    assert.equal(payload.prefix?.registeredAt, "2026-08-06T06:36:23.000Z");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});

test("RDAP prefix age uses registration, not last changed", () => {
  const prefix = prefixFromRdap({
    handle: "NET-8-8-8-0-2",
    startAddress: "8.8.8.0",
    endAddress: "8.8.8.255",
    cidr0_cidrs: [{ v4prefix: "8.8.8.0", length: 24 }],
    events: [
      { eventAction: "last changed", eventDate: "2023-12-28T17:24:56-05:00" },
      { eventAction: "registration", eventDate: "2023-12-28T17:24:33-05:00" },
    ],
  });
  assert.equal(prefix?.registeredAt, "2023-12-28T22:24:33.000Z");
  assert.equal(prefix?.cidr, "8.8.8.0/24");
  assert.equal(
    prefixFromRdap({
      events: [{ eventAction: "last changed", eventDate: "2026-01-01T00:00:00Z" }],
    }),
    null,
  );
});
