import assert from "node:assert/strict";
import { test } from "node:test";
import { attributeTags, regionTag } from "../src/views/ai/attribute-tags.ts";
import { adaptCoffee } from "../src/views/ip/coffee.ts";

test("partial negative risk fields cannot certify no proxy", () => {
  for (const fields of [
    {},
    { is_vpn: false },
    { is_proxy: false, is_tor: false },
    { is_abuser: false },
  ]) {
    const data = adaptCoffee({ ip: "203.0.113.1", ...fields });
    const tags = attributeTags(data.coffee, data.risk);
    assert.ok(!tags.some((tag) => tag.label === "无代理标记"));
  }
  const data = adaptCoffee({
    ip: "203.0.113.1",
    is_vpn: false,
    is_proxy: false,
    is_tor: false,
  });
  assert.ok(
    attributeTags(data.coffee, data.risk).some(
      (tag) => tag.label === "无代理标记",
    ),
  );
});
test("conflicting usage fields are not shown as confirmed residential", () => {
  const data = adaptCoffee({
    ip: "203.0.113.1",
    isResidential: true,
    is_datacenter: true,
  });
  const tags = attributeTags(data.coffee, data.risk);
  assert.ok(tags.some((tag) => tag.label === "属性字段存在分歧"));
  assert.ok(!tags.some((tag) => tag.label === "住宅 IP"));
});
test("region tags report location without claiming platform support", () => {
  for (const country of ["CN", "US", "RU", "IR"]) {
    assert.match(regionTag("us", country).label, new RegExp(country));
    assert.doesNotMatch(regionTag("us", country).label, /正常|支持/);
  }
});
