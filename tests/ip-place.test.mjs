import assert from "node:assert/strict";
import { test } from "node:test";
import { consensusPlace, normCity } from "../src/views/ip/model/place.ts";

const IP = "74.120.253.118";

const coffee = {
  ip: IP,
  city: "Denver (North Capitol Hill)",
  region: "Colorado",
  country: "United States",
  countryCode: "us",
  geo_sources: [
    { src: "g1", city: "Denver (North Capitol Hill)", region: "Colorado", country: "United States" },
    { src: "g2", country: "United States", lat: 37.751, lon: -97.822 },
    { src: "g3", city: "New York", region: "New York", country: "United States", lat: 40.7128, lon: -74.006 },
  ],
};

function place(source, city, region = "New York", extra = {}) {
  return {
    source,
    href: `https://example.test/${source}`,
    city,
    region,
    country: "United States",
    country_code: "US",
    ...extra,
  };
}

test("New York and New York City count as the same city", () => {
  assert.equal(normCity("New York City"), "new york");
  assert.equal(normCity("New York"), "new york");
});

test("the header uses the majority city from the nine-source catalog, not Coffee's primary city", () => {
  const result = consensusPlace(coffee, {
    ip: IP,
    readings: [],
    unavailable: [],
    places: [
      place("ipinfo", "New York City", "New York", {
        latitude: 40.71427,
        longitude: -74.00597,
      }),
      place("ip2location", "New York City"),
      place("ipapi", "New York", "New York", {
        latitude: 40.7128,
        longitude: -74.006,
      }),
      place("proxycheck", "New York", "New York", {
        latitude: 40.7128,
        longitude: -74.006,
      }),
    ],
  });

  assert.equal(result.city, "New York");
  assert.equal(result.region, "New York");
  assert.equal(result.country, "United States");
  assert.equal(result.split, true);
  assert.equal(result.located, 5);
  assert.match(result.line, /New York/);
  assert.ok(!result.line.includes("Denver"));
  assert.ok(result.latitude != null && result.latitude > 40 && result.latitude < 41);
  assert.ok(result.longitude != null && result.longitude < -73);
  assert.equal(
    result.votes.find((item) => item.id === "coffee")?.city,
    "Denver (North Capitol Hill)",
  );
  assert.equal(result.votes.find((item) => item.id === "ipqs")?.status, "outbound");
});

test("Coffee's US-centroid coordinates are not used for a Denver label", () => {
  const result = consensusPlace(coffee, { ip: IP, readings: [], unavailable: [], places: [] });
  assert.equal(result.city, "Denver (North Capitol Hill)");
  assert.equal(result.latitude, undefined);
  assert.equal(result.longitude, undefined);
});
