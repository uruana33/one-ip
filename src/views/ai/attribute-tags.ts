import { t } from "@/i18n";
import type { Risk } from "@/lib/types";
import type { CoffeeIp } from "@/views/ip/coffee";
import { usageConflict } from "@/views/ip/model/verdict";
import type { AiCamp } from "./platforms";

type Tag = { label: string; tone: "good" | "warn" | "bad" | "muted" };

function trustScore(coffee: CoffeeIp | undefined): number | null {
  const score = coffee?.trust_score;
  return typeof score === "number" &&
    Number.isFinite(score) &&
    score >= 0 &&
    score <= 100
    ? Math.round(score)
    : null;
}

export function attributeTags(
  coffee: CoffeeIp | undefined,
  risk: Risk | undefined,
): Tag[] {
  const tags: Tag[] = [];
  const conflict = coffee ? usageConflict(coffee).length > 1 : false;
  if (conflict) tags.push({ label: t("属性字段存在分歧"), tone: "warn" });
  else if (coffee?.is_public_service === true)
    tags.push({ label: t("公共服务"), tone: "muted" });
  else if (coffee?.isResidential === true)
    tags.push({ label: t("住宅网络标记"), tone: "muted" });
  else if (coffee?.is_datacenter === true)
    tags.push({ label: t("机房 IP"), tone: "warn" });
  else if (coffee?.isResidential === false)
    tags.push({ label: t("非住宅 IP"), tone: "warn" });
  const flagged = risk?.vpn || risk?.proxy || risk?.tor || risk?.recent_abuse;
  if (risk?.vpn) tags.push({ label: "VPN", tone: "warn" });
  if (risk?.proxy) tags.push({ label: t("代理"), tone: "warn" });
  if (risk?.tor) tags.push({ label: "Tor", tone: "bad" });
  if (risk?.recent_abuse) tags.push({ label: t("滥用记录"), tone: "bad" });
  if (
    !flagged &&
    risk?.vpn === false &&
    risk.proxy === false &&
    risk.tor === false
  )
    tags.push({ label: t("无代理标记"), tone: "good" });
  const score = trustScore(coffee);
  if (score != null)
    tags.push({
      label: t("信任 {0}", [score]),
      tone: score >= 70 ? "good" : score >= 40 ? "warn" : "bad",
    });
  if (risk?.source)
    tags.push({ label: t("属性来源 · {0}", [risk.source]), tone: "muted" });
  return tags;
}

export function regionTag(
  camp: AiCamp,
  countryCode: string | undefined,
): Tag | null {
  if (!countryCode) return null;
  const cc = countryCode.toLowerCase();
  return {
    label: t("出口位置 · {0}", [cc.toUpperCase()]),
    tone: camp === "us" && cc === "cn" ? "warn" : "muted",
  };
}
