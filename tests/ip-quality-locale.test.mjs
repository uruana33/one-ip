import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

test("English conclusions use structured evidence rather than matching Chinese labels", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--import",
      "./tests/register-paths.mjs",
      "--input-type=module",
      "-e",
      `
    globalThis.window = { location: { href: 'https://example.test/?lang=en' } };
    const { assessQuality } = await import('./src/views/ip/model/quality.ts');
    const result = assessQuality({ip:'124.126.3.108',trust_score:97,isResidential:true,is_vpn:false,is_proxy:false,is_tor:false}, {
      ip:'124.126.3.108',unavailable:[],readings:[{id:'ippure-purity',source:'ippure',metric:'purity',value:'73',hint:'',tone:'warn',href:'https://example.test'}]
    });
    console.log(JSON.stringify({summary:result.summary,reputation:result.reputation.value}));
  `,
    ],
    { encoding: "utf8" },
  );
  const result = JSON.parse(output);
  assert.match(result.summary, /IPPure.*73/);
  assert.match(result.reputation, /lower risk/);
  assert.doesNotMatch(result.reputation, /Confirm fraud/);
});
