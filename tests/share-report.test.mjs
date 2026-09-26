import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildHomeShareSummary,
  reportMarkdown,
} from "../src/lib/share-report.ts";

test("home summary and markdown stay within the public snapshot shape", () => {
  assert.equal(
    buildHomeShareSummary({ verdict: "pending", domesticIp: "1.1.1.1" }),
    null,
  );
  const summary = buildHomeShareSummary({
    verdict: "different",
    domesticIp: "1.1.1.1",
    overseasIp: "8.8.8.8",
    qualityScore: 52.2,
    asn: "13335",
    isp: "Example",
    flags: { datacenter: true },
  });
  assert.equal(summary.egress_consistent, false);
  assert.equal(summary.quality_score, 52);
  assert.equal(summary.quality_status, "moderate");
  assert.equal(summary.asn, 13335);
  assert.equal(summary.webrtc_match_http, null);
  const markdown = reportMarkdown({
    url: "https://ip.gogoxy.com/r/r_0123456789ABCDEF",
    summary,
  });
  assert.match(markdown, /## 出口观测台报告/);
  assert.match(markdown, /国内／海外出口：不一致/);
  assert.match(markdown, /WebRTC vs HTTP：未检测/);
  assert.match(markdown, /质量分：52（moderate）/);
  assert.match(markdown, /https:\/\/ip\.gogoxy\.com\/r\/r_0123456789ABCDEF/);
});
