import { t } from "@/i18n";
import type { CrossIntel } from "@/views/ip/model/cross-intel";
import { consensusPlace } from "@/views/ip/model/place";
import { assessQuality, factLine } from "@/views/ip/model/quality";
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
    `${t("质量结论")}: ${quality.bandLabel} · ${quality.kindLabel}${
      quality.score != null ? ` · ${t("质量分")} ${quality.score}` : ""
    }`,
    quality.summary,
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
