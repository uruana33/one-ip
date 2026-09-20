import { t } from "@/i18n";
import type { CrossIntel } from "@/views/ip/model/cross-intel";
import { consensusPlace } from "@/views/ip/model/place";
import {
  assessQuality,
  factLine,
  qualityScoreNotice,
} from "@/views/ip/model/quality";
import type { CoffeeLookup } from "../coffee";

/**
 * A plain-text digest of the page, for pasting into a ticket or a chat.
 * Labels come from the same i18n table as the UI, so the report reads exactly
 * like the screen the reader was looking at.
 */
export function buildReport(
  data: CoffeeLookup,
  intel?: CrossIntel | null,
): string {
  const d = data.coffee;
  const quality = assessQuality(d, intel ?? null);
  const place = consensusPlace(d, intel ?? null);
  const lines = [
    `IP: ${d.ip}`,
    [place.country, place.region, place.city, d.isp]
      .filter(Boolean)
      .join(" · "),
    d.asn ? `AS${d.asn} ${d.asOrganization ?? d.asname ?? ""}`.trim() : "",
    `${t("质量结论")}: ${quality.headline}${
      quality.score != null
        ? ` · ${t("质量分")} ${quality.score}${quality.scoreStatus === "provisional" ? ` (${t("估算")})` : ""}`
        : ""
    }`,
    quality.shortSummary,
    quality.publicService
      ? `${t("官方用途记录：{0}", [quality.publicService.label])} · ${quality.publicService.href} · ${t("核对日期 {0}；仅证明服务用途，不代表信誉或匿名检测结果。", [quality.publicService.verifiedAt.slice(0, 10)])}`
      : "",
    t("有效来源：信誉 {0} · 匿名 {1} · 用途 {2}", [
      quality.evidence.reputation.length,
      quality.evidence.anonymity.length,
      quality.evidence.usage.length,
    ]),
    qualityScoreNotice(quality),
    quality.scoreProfile === "ipv6-four-source"
      ? t("IPv6 配置：IPPure 不适用")
      : "",
    t("本站规则参考，不代表平台通过率或账号安全。"),
    `${quality.network.label}: ${quality.network.value}`,
    `${quality.reputation.label}: ${quality.reputation.value}`,
    quality.freshness
      ? `${quality.freshness.label}: ${quality.freshness.value}`
      : "",
    ...quality.sources
      .filter((item) => item.status === "ready" || item.status === "outbound")
      .map((item) => `${item.name} (${item.metric}): ${factLine(item.facts)}`),
  ];
  return lines.filter(Boolean).join("\n");
}
