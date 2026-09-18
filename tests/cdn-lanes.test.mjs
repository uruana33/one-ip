import assert from "node:assert/strict";
import { test } from "node:test";
import { providers } from "../src/views/cdn/providers.ts";
import {
  cdnLaneGroups,
  cdnLeafKind,
  cdnMemberId,
  cdnNodeLabel,
  groupCdnLanes,
  parseCdnLeafId,
  splitCdnForest,
} from "../src/views/egress/cdn-lanes.ts";

function hit(partial) {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    family: partial.family,
    familyLabel: partial.familyLabel ?? partial.family,
    path: partial.path,
    website: partial.website ?? "https://example.com",
    url: partial.url ?? "https://example.com/probe",
    node: partial.node,
    cache: partial.cache,
    loading: Boolean(partial.loading),
    error: partial.error,
  };
}

test("colo chips keep POP codes and drop header names", () => {
  assert.equal(cdnNodeLabel("HKG"), "HKG");
  assert.equal(cdnNodeLabel("colo=SJC"), "SJC");
  assert.equal(cdnNodeLabel("server: bunnycdn-sg"), "SG");
  assert.equal(cdnNodeLabel("server: bunnycdn-LA1-985"), "LA1-985");
  assert.equal(cdnNodeLabel("x-served-by: cache-hkg17929-HKG"), "HKG");
  assert.equal(cdnNodeLabel("x-served-by: cache-fra-etou8220188"), "FRA");
  assert.equal(cdnNodeLabel("x-amz-cf-pop: NRT57-P4"), "NRT57-P4");
  assert.equal(cdnNodeLabel("via: 1.1 varnish · x-via: cache-hkg"), "HKG");
  assert.equal(cdnNodeLabel("via: http/1.1 US.LAX.837.P7"), "LAX");
  assert.equal(cdnNodeLabel("2.0 PS-TSN-01m6x17 [HIT]"), "TSN");
  assert.equal(cdnNodeLabel("28637:fJ.sjc1:co:1610"), "sjc1");
  assert.equal(cdnNodeLabel("us-west2"), "us-west2");
  assert.equal(cdnNodeLabel("cache12.bjdaxingqu-cu.ix"), "bjdaxingqu");
  assert.equal(cdnNodeLabel("|74.120.253.118|23.215.44.12|"), "23.215.44.12");
  assert.equal(cdnLeafKind("23.215.44.12"), "ip");
  assert.equal(cdnLeafKind("SJC"), "text");
});

test("same vendor family collapses; domestic and overseas stay on separate lanes", () => {
  const lanes = groupCdnLanes([
    hit({
      id: "bunny-standard",
      family: "bunny",
      familyLabel: "Bunny",
      path: "overseas",
      node: "server: bunnycdn-hkg",
    }),
    hit({
      id: "bunny-volume",
      family: "bunny",
      familyLabel: "Bunny",
      path: "overseas",
      node: "server: bunnycdn-sin",
    }),
    hit({
      id: "cloudflare",
      family: "cloudflare",
      familyLabel: "Cloudflare",
      path: "overseas",
      node: "LAX",
    }),
    hit({
      id: "cloudflare-cn",
      family: "cloudflare",
      familyLabel: "Cloudflare",
      path: "domestic",
      node: "SHA",
    }),
    hit({
      id: "akamai",
      family: "akamai",
      familyLabel: "Akamai",
      path: "overseas",
      loading: true,
    }),
  ]);

  assert.deepEqual(
    lanes.map((lane) => lane.key),
    [
      "overseas:bunny",
      "overseas:cloudflare",
      "domestic:cloudflare",
      "overseas:akamai",
    ],
  );
  assert.equal(lanes[0].samples, 2);
  assert.deepEqual(
    cdnLaneGroups(lanes[0]).map((group) => group.key),
    ["colo"],
  );
  assert.equal(lanes[3].kind, "pending");
});

test("split HTTP exits become two CDN subtrees", () => {
  const lanes = groupCdnLanes([
    hit({
      id: "netease",
      family: "netease",
      familyLabel: "网易",
      path: "domestic",
      node: "cdn-source: netease",
    }),
    hit({
      id: "fastly",
      family: "fastly",
      familyLabel: "Fastly",
      path: "overseas",
      node: "x-served-by: cache-sjc",
    }),
    hit({
      id: "quantil",
      family: "wangsu",
      familyLabel: "网宿",
      path: "domestic",
      error: "blocked",
    }),
  ]);
  const trees = splitCdnForest(
    lanes,
    [
      { ip: "140.210.32.232", country_code: "CN", path: "domestic" },
      { ip: "74.120.253.118", country_code: "US", path: "overseas" },
    ],
    false,
  );
  assert.deepEqual(
    trees.map((tree) => tree.key),
    ["domestic", "overseas"],
  );
  assert.equal(trees[0].origin?.ip, "140.210.32.232");
  assert.equal(trees[1].origin?.ip, "74.120.253.118");
  assert.deepEqual(
    trees[0].lanes.map((lane) => lane.family),
    ["netease", "wangsu"],
  );
  assert.deepEqual(
    trees[1].lanes.map((lane) => lane.family),
    ["fastly"],
  );
});

test("CDN leaf ids round-trip vendor probes", () => {
  const id = cdnMemberId("overseas:bunny", "colo", "bunny-standard");
  assert.deepEqual(parseCdnLeafId(id), {
    laneKey: "overseas:bunny",
    groupKey: "colo",
    id: "bunny-standard",
  });
});

test("catalog hangs China-facing CDNs on the domestic path", () => {
  assert.deepEqual(
    providers
      .filter((item) => item.path === "domestic")
      .map((item) => item.id)
      .sort(),
    ["bytedance", "cloudflare-cn", "edgeone", "netease", "quantil"],
  );
  assert.equal(providers.length, 21);
  assert.equal(
    new Set(
      providers
        .filter((item) => item.family === "bunny")
        .map((item) => item.path),
    ).size,
    1,
  );
});
