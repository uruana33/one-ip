import { CopyButton } from "@/components/copy-button";
import { CountryFlag } from "@/components/country-flag";
import { SiteLogo } from "@/components/site-logo";
import { IpText, Pending } from "@/components/toolkit";
import { t } from "@/i18n";
import { queryKeys } from "@/lib/query-keys";
import type { Risk } from "@/lib/types";
import { lookupIp } from "@/views/ip/api";
import type { CoffeeIp } from "@/views/ip/coffee";
import { useQuery } from "@tanstack/react-query";
import type { DefaultExitSource } from "./default-exit";
import type { AiCamp } from "./platforms";
import type { AiNetworkItem } from "./use-ai-network";

function latencyTone(
  median: number | null | undefined,
  pending: boolean,
): "pending" | "fail" | "good" | "ok" | "slow" {
  if (pending && median == null) return "pending";
  if (median == null || median < 0) return "fail";
  if (median < 100) return "good";
  if (median < 400) return "ok";
  return "slow";
}

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

function attributeTags(
  coffee: CoffeeIp | undefined,
  risk: Risk | undefined,
): Tag[] {
  const tags: Tag[] = [];
  if (coffee?.isResidential === true)
    tags.push({ label: t("住宅 IP"), tone: "good" });
  else if (coffee?.is_datacenter === true)
    tags.push({ label: t("机房 IP"), tone: "warn" });
  else if (coffee?.isResidential === false)
    tags.push({ label: t("非住宅 IP"), tone: "warn" });
  const flagged = risk?.vpn || risk?.proxy || risk?.tor || risk?.recent_abuse;
  if (risk?.vpn) tags.push({ label: "VPN", tone: "warn" });
  if (risk?.proxy) tags.push({ label: t("代理"), tone: "warn" });
  if (risk?.tor) tags.push({ label: "Tor", tone: "bad" });
  if (risk?.recent_abuse) tags.push({ label: t("滥用记录"), tone: "bad" });
  if (!flagged && risk?.available)
    tags.push({ label: t("无代理标记"), tone: "good" });
  const score = trustScore(coffee);
  if (score != null)
    tags.push({
      label: t("信任 {0}", [score]),
      tone: score >= 70 ? "good" : score >= 40 ? "warn" : "bad",
    });
  return tags;
}

function regionTag(camp: AiCamp, countryCode: string | undefined): Tag | null {
  if (!countryCode) return null;
  const cc = countryCode.toLowerCase();
  if (camp === "us")
    return cc === "cn"
      ? { label: t("出口在中国大陆"), tone: "bad" }
      : { label: t("属地正常"), tone: "good" };
  return cc === "cn"
    ? { label: t("属地正常"), tone: "good" }
    : { label: t("出口在海外"), tone: "warn" };
}

function LatencyReadout({
  item,
  pending,
}: {
  item: AiNetworkItem;
  pending: boolean;
}) {
  const { result } = item;
  const median = result?.median;
  if (pending && median == null)
    return (
      <span className="ai-hero-latency-value">
        <Pending>{t("检测中…")}</Pending>
      </span>
    );
  if (median == null)
    return (
      <span
        className="ai-hero-latency-value ai-hero-latency-none"
        title={result?.description}
      >
        {result?.status === "restricted" ? t("检测受限") : t("未确认")}
      </span>
    );
  return (
    <span className="ai-hero-latency-value" title={result?.description}>
      <span className="ai-hero-latency-number">{Math.round(median)}</span>
      <span className="ai-hero-latency-unit">ms</span>
    </span>
  );
}

function ExitChip({ item }: { item: AiNetworkItem }) {
  const { platform, defaultExit } = item;
  if (!platform) return null;
  if (platform.traceDomain)
    return (
      <span
        className="ai-camp-exit-label"
        title={t(
          "通过该平台可读取的 trace 端点测得，反映本次访问该平台端点的出口。",
        )}
      >
        {t("平台实测出口")}
      </span>
    );
  if (defaultExit?.verdict === "verified") {
    const ok = defaultExit.sources.filter((source) => source.ip);
    return (
      <span
        className="ai-camp-exit-label ai-camp-exit-label-good"
        title={t("{0} 个独立来源（{1}）返回相同出口，可信度高。", [
          ok.length,
          ok.map((source) => source.label).join(" · "),
        ])}
      >
        {t("HTTP 默认出口 · 已验证")}
      </span>
    );
  }
  if (defaultExit?.verdict === "split") {
    const detail = defaultExit.sources
      .map((source) => `${source.label}: ${source.ip ?? "—"}`)
      .join(" · ");
    return (
      <span
        className="ai-camp-exit-label ai-camp-exit-label-warn"
        title={t(
          "不同线路返回不同出口（{0}），存在分流；访问该平台的实际出口可能与显示值不同。",
          [detail],
        )}
      >
        {t("观察到分流")}
      </span>
    );
  }
  if (defaultExit?.displaySource) {
    const source = defaultExit.displaySource;
    const label = defaultExitChipLabel(source);
    const title =
      source.transport === "udp"
        ? t(
            "仅 WebRTC/STUN 返回公网地址；这是 UDP 观察出口，不等于该 AI 平台的 HTTP 出口。",
          )
        : t(
            "该平台无实测接口；显示 {0} 看到的 HTTP 出口，可能不同于访问该平台的出口。",
            [source.label],
          );
    return (
      <span
        className="ai-camp-exit-label ai-camp-exit-label-muted"
        title={title}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className="ai-camp-exit-label ai-camp-exit-label-muted"
      title={t(
        "该平台无实测接口；检测会优先显示 HTTP 默认出口，只有 HTTP 不可用时才显示 UDP 观察出口。",
      )}
    >
      {t("HTTP 默认出口 · 待确认")}
    </span>
  );
}

function routeLabel(id: DefaultExitSource["id"]): string {
  if (id === "webrtc") return t("UDP 观察出口");
  if (id === "worker") return t("HTTP 默认出口 · 本站接口");
  if (id === "domestic") return t("HTTP 出口 · 国内 CDN");
  return t("HTTP 默认出口 · api.ip.sb");
}

function defaultExitChipLabel(source: DefaultExitSource): string {
  if (source.id === "webrtc") return t("UDP 观察出口");
  if (source.id === "worker") return t("HTTP 默认出口 · 本站接口");
  if (source.id === "domestic") return t("HTTP 出口 · 国内 CDN");
  return t("HTTP 默认出口 · api.ip.sb");
}

function SplitRoute({ source }: { source: DefaultExitSource }) {
  const lookup = useQuery({
    queryKey: queryKeys.ip.classification(source.ip ?? ""),
    enabled: Boolean(source.ip),
    queryFn: ({ signal }) => lookupIp(source.ip!, signal),
    staleTime: 300_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const geo = lookup.data?.geo;
  const geoLine =
    [geo?.country, geo?.city, geo?.isp].filter(Boolean).join(" · ") || null;
  const tags = lookup.data
    ? attributeTags(lookup.data.coffee, lookup.data.risk)
    : null;
  return (
    <div className="ai-hero-route">
      <div className="ai-hero-route-head">
        <span className="ai-hero-route-label" title={source.label}>
          {routeLabel(source.id)}
        </span>
        <span className="ai-hero-ip">
          <IpText ip={source.ip} />
          {source.ip ? (
            <CopyButton value={source.ip} className="ai-hero-copy" />
          ) : null}
          {geo?.country_code ? <CountryFlag code={geo.country_code} /> : null}
        </span>
      </div>
      <p className="ai-hero-geo" title={geoLine ?? undefined}>
        {lookup.isPending || lookup.isFetching ? (
          <Pending>{t("查询归属…")}</Pending>
        ) : (
          (geoLine ?? (lookup.isError ? t("属性暂不可用") : t("归属未知")))
        )}
      </p>
      <div className="ai-camp-card-tags">
        {tags ? (
          tags.map((tag) => (
            <span key={tag.label} className={`ai-tag ai-tag-${tag.tone}`}>
              {tag.label}
            </span>
          ))
        ) : lookup.isPending || lookup.isFetching ? (
          <span className="ai-tag ai-tag-muted">
            <Pending>{t("属性检测中…")}</Pending>
          </span>
        ) : (
          <span className="ai-tag ai-tag-muted">{t("属性暂不可用")}</span>
        )}
      </div>
    </div>
  );
}

export function CampCard({
  item,
  pending,
}: {
  item: AiNetworkItem;
  pending: boolean;
}) {
  const { domain, platform, result, exit, lookup } = item;
  if (!platform) return null;
  const isPlatformExit = Boolean(platform.traceDomain);
  const median = result?.median;
  const tone = latencyTone(median, pending);
  const online = median != null;
  const geo = lookup.data?.geo;
  const coffee = lookup.data?.coffee;
  const countryCode = geo?.country_code ?? exit.countryCode;
  const geoLine =
    [geo?.country, geo?.city, geo?.isp].filter(Boolean).join(" · ") || null;
  const asnLine = coffee
    ? [
        coffee.asn ? `AS${coffee.asn}` : null,
        coffee.asOrganization ?? coffee.asname,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;
  const exitPending = exit.pending && !exit.ip;
  const exitIp = exit.ip;
  const splitSources =
    !isPlatformExit && item.defaultExit?.verdict === "split"
      ? item.defaultExit.sources.filter((source) => source.ip)
      : null;
  const tags = lookup.data
    ? [
        ...attributeTags(coffee, lookup.data.risk),
        ...(() => {
          const tag = isPlatformExit
            ? regionTag(platform.camp, countryCode)
            : null;
          return tag ? [tag] : [];
        })(),
      ]
    : null;
  const evidenceLabel = isPlatformExit
    ? t("证据来源 · Cloudflare Trace")
    : item.defaultExit?.verdict === "verified"
      ? t("证据来源 · 多来源 HTTP 交叉验证")
      : item.defaultExit?.verdict === "split"
        ? t("证据来源 · 多线路观察")
        : exit.source
          ? t("证据来源 · {0}", [exit.source.label])
          : t("证据来源 · 默认出口观察");
  return (
    <article className="ai-hero-card hud-frame" data-tone={tone}>
      <div className="ai-hero-scan" aria-hidden="true" />
      <header className="ai-hero-head">
        <span className="ai-hero-identity">
          <span className="ai-hero-logo">
            <SiteLogo
              website={`https://${domain}`}
              className="size-6 rounded-sm"
            />
          </span>
          <span className="ai-hero-name-block">
            <span className="ai-hero-name">{platform.name}</span>
            <span className="ai-hero-domain">{domain}</span>
          </span>
        </span>
        <span className="ai-hero-latency">
          <span
            className={`ai-hero-status-dot${online ? " ai-hero-status-live" : ""}`}
            aria-hidden="true"
          />
          <LatencyReadout item={item} pending={pending} />
        </span>
      </header>
      <div className="ai-hero-exit">
        <div className="ai-hero-exit-head">
          <ExitChip item={item} />
          {!splitSources &&
            (exitPending ? (
              <Pending>{t("检测中…")}</Pending>
            ) : exitIp ? (
              <span className="ai-hero-ip">
                <IpText ip={exitIp} />
                <CopyButton value={exitIp} className="ai-hero-copy" />
                {countryCode ? <CountryFlag code={countryCode} /> : null}
              </span>
            ) : (
              <span className="muted">
                {isPlatformExit ? t("暂不可用") : t("检测失败")}
              </span>
            ))}
        </div>
        <p className="ai-hero-evidence">
          {evidenceLabel}
          {isPlatformExit && platform.traceDomain ? (
            <span> · {t("专属 trace 端点")}</span>
          ) : null}
        </p>
        {splitSources ? (
          <>
            <div className="ai-hero-routes">
              {splitSources.map((source) => (
                <SplitRoute key={source.id} source={source} />
              ))}
            </div>
            <p className="ai-hero-split-note">
              {t(
                "检测到分流：访问该平台实际走哪条线路取决于分流规则，浏览器无法直接确认。",
              )}
            </p>
          </>
        ) : (
          <>
            <p className="ai-hero-geo" title={geoLine ?? undefined}>
              {lookup.isPending || lookup.isFetching ? (
                <Pending>{t("查询归属…")}</Pending>
              ) : (
                (geoLine ??
                (lookup.isError ? t("属性暂不可用") : t("归属未知")))
              )}
            </p>
            {asnLine ? <p className="ai-hero-asn">{asnLine}</p> : null}
            <div className="ai-camp-card-tags">
              {tags ? (
                tags.map((tag) => (
                  <span key={tag.label} className={`ai-tag ai-tag-${tag.tone}`}>
                    {tag.label}
                  </span>
                ))
              ) : lookup.isPending || lookup.isFetching ? (
                <span className="ai-tag ai-tag-muted">
                  <Pending>{t("属性检测中…")}</Pending>
                </span>
              ) : (
                <span className="ai-tag ai-tag-muted">{t("属性暂不可用")}</span>
              )}
            </div>
          </>
        )}
      </div>
    </article>
  );
}
