import { useEffect, useState } from "react";
import { ActionButton } from "@/components/toolkit";
import { t } from "@/i18n";
import { companyTypeColors } from "@/lib/ip-badge-colors";
import { isHomeQueryKey, queryKeys } from "@/lib/query-keys";
import { lookupCross, lookupIp } from "@/views/ip/api";
import { assessQuality } from "@/views/ip/model/quality";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { getGeo, getBrowserIp, getDomesticIp } from "./api";
import { SplitTunnelVisualizer } from "./split-tunnel-visualizer";

export function HomePage() {
  const client = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    const filters = {
      predicate: (query: { queryKey: readonly unknown[] }) =>
        isHomeQueryKey(query.queryKey),
    };
    try {
      await client.cancelQueries(filters);
      await client.resetQueries(filters);
    } finally {
      setRefreshing(false);
    }
  };
  useEffect(() => {
    document.title = t("首页 - IP 网络工具");
  }, []);
  const probes = useQueries({
    queries: [
      {
        queryKey: queryKeys.egress.domestic(),
        retry: false,
        queryFn: ({ signal }: { signal: AbortSignal }) => getDomesticIp(signal),
      },
      {
        queryKey: queryKeys.home.browserIp(),
        queryFn: ({ signal }: { signal: AbortSignal }) =>
          getBrowserIp(4, signal),
      },
    ].map((probe) => ({ retry: false, staleTime: 60_000, ...probe })),
  });
  const cards = probes.flatMap((query, index) => {
    // Only dedicated probes belong in the overview; per-site routes stay in SplitResults.
    if (!query.data || query.data.ip.includes(":")) return [];
    if (index === 1 && query.data?.ip === probes[0].data?.ip) return [];
    return [
      {
        query,
        data: query.data,
        version: 4,
        label: index === 0 ? t("IPv4 · 国内探测") : t("IPv4 · 外部探测"),
      },
    ];
  });
  const ips = [
    ...new Set(cards.flatMap(({ data }) => (data ? [data.ip] : []))),
  ];
  const geoQueries = useQueries({
    queries: ips.map((ip) => ({
      queryKey: queryKeys.geo.byIp(ip),
      queryFn: ({ signal }: { signal: AbortSignal }) => getGeo(ip, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const geoByIp = new Map(ips.map((ip, index) => [ip, geoQueries[index]]));
  const typeQueries = useQueries({
    queries: ips.map((ip) => ({
      queryKey: queryKeys.ip.classification(ip),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        lookupIp(ip, AbortSignal.any([signal, AbortSignal.timeout(3000)])),
      staleTime: 3600_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const typeByIp = new Map(ips.map((ip, index) => [ip, typeQueries[index]]));
  const crossQueries = useQueries({
    queries: ips.map((ip) => ({
      queryKey: queryKeys.ip.cross(ip),
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        try {
          return await lookupCross(ip, signal);
        } catch {
          return { ip, readings: [], unavailable: [] };
        }
      },
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const crossByIp = new Map(ips.map((ip, index) => [ip, crossQueries[index]]));
  const domesticCard = cards[0];
  const overseasCard = cards.length > 1 ? cards[1] : undefined;
  const domesticGeo = domesticCard?.data
    ? geoByIp.get(domesticCard.data.ip)?.data
    : undefined;
  const overseasGeo = overseasCard?.data
    ? geoByIp.get(overseasCard.data.ip)?.data
    : undefined;

  const cardsData = cards.map(({ query, data, version, label }, index) => {
    const pending = !data && query.isPending;
    const geo = data ? { ...data, ...geoByIp.get(data.ip)?.data } : undefined;
    const classification = data ? typeByIp.get(data.ip) : undefined;
    const company = classification?.isSuccess
      ? classification.data.coffee
      : undefined;
    const cross = data ? crossByIp.get(data.ip) : undefined;
    const assessment = company
      ? assessQuality(company, cross?.data ?? null, {
          pending: Boolean(cross?.isFetching && !cross.data),
        })
      : null;
    const score = assessment?.score ?? undefined;
    const hasScore = assessment?.score != null;
    const typeLabels = company
      ? [
          company.company_type
            ? {
                label: company.company_type,
                color:
                  companyTypeColors[company.company_type.toLowerCase()] ??
                  "bg-primary/5 text-primary dark:bg-primary/10",
              }
            : null,
          company.is_public_service === true
            ? {
                label: t("公共服务"),
                color: "bg-primary/15 text-primary dark:bg-primary/20",
              }
            : null,
          company.isResidential === true && !company.is_public_service
            ? {
                label: t("家庭住宅 IP"),
                color:
                  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30",
              }
            : null,
          company.is_datacenter === true && !company.is_public_service
            ? {
                label: t("机房 IP"),
                color: "bg-primary/10 text-primary dark:bg-primary/15",
              }
            : null,
          company.is_mobile === true
            ? {
                label: t("移动网络"),
                color: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
              }
            : null,
          company.is_proxy === true ||
          company.is_vpn === true ||
          company.is_tor === true
            ? {
                label: t("代理 / VPN / Tor"),
                color:
                  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30",
              }
            : null,
        ].filter(
          (item): item is { label: string; color: string } => item !== null,
        )
      : [];
    const loading = pending || Boolean(data && geoByIp.get(data.ip)?.isPending);
    return {
      index,
      label,
      data,
      geo,
      version,
      hasScore,
      score,
      typeLabels,
      loading,
      pending,
      onRetry: () => data && geoByIp.get(data.ip)?.refetch(),
    };
  });

  return (
    <div className="home-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-base font-semibold tracking-tight text-foreground cyber-gradient-title">
            {t("网络概览")}
          </h1>
          {cards.length > 1 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/25">
              <span className="size-1.5 rounded-full bg-primary animate-pulse" />
              {t("智能分流环境已生效")}
            </span>
          ) : null}
        </div>
        <ActionButton
          size="sm"
          variant="outline"
          busy={refreshing}
          onClick={refresh}
          className="shrink-0"
        >
          {refreshing ? t("检测中...") : t("重新检测")}
        </ActionButton>
      </div>
      <SplitTunnelVisualizer
        isSplit={cards.length > 1}
        cardsData={cardsData}
        domesticIp={domesticCard?.data?.ip}
        domesticGeo={domesticGeo}
        domesticPending={!domesticCard?.data && domesticCard?.query.isPending}
        overseasIp={overseasCard?.data?.ip}
        overseasGeo={overseasGeo}
        overseasPending={Boolean(
          overseasCard && !overseasCard.data && overseasCard.query.isPending,
        )}
      />
    </div>
  );
}

export default HomePage;
