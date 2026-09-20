import { useEffect, useState } from "react";
import { ActionButton } from "@/components/toolkit";
import { t } from "@/i18n";
import { isHomeQueryKey, queryKeys } from "@/lib/query-keys";
import { lookupCross, lookupIp } from "@/views/ip/api";
import { assessQuality } from "@/views/ip/model/quality";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import {
  CircleHelp,
  LoaderCircle,
  ScanSearch,
  ShieldCheck,
  Split,
} from "lucide-react";
import { getGeo, getBrowserIp, getDomesticIp } from "./api";
import "./home-visual.css";
import { assessHomeExits, selectHomeCards } from "./overview";
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
  const cards = selectHomeCards(probes).map((card) => ({
    ...card,
    version: 4,
    label:
      card.role === "shared"
        ? t("IPv4 · 两次探测一致")
        : card.role === "domestic"
          ? t("IPv4 · 国内探测")
          : t("IPv4 · 外部探测"),
  }));
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
      staleTime: 5 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const typeByIp = new Map(ips.map((ip, index) => [ip, typeQueries[index]]));
  const crossQueries = useQueries({
    queries: ips.map((ip) => ({
      queryKey: queryKeys.ip.cross(ip),
      queryFn: ({ signal }: { signal: AbortSignal }) => lookupCross(ip, signal),
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const crossByIp = new Map(ips.map((ip, index) => [ip, crossQueries[index]]));
  const domesticCard = cards.find(
    (card) => card.role === "domestic" || card.role === "shared",
  );
  const overseasCard = cards.find(
    (card) => card.role === "external" || card.role === "shared",
  );
  const domesticGeo = domesticCard?.data
    ? geoByIp.get(domesticCard.data.ip)?.data
    : undefined;
  const overseasGeo = overseasCard?.data
    ? geoByIp.get(overseasCard.data.ip)?.data
    : undefined;

  const cardsData = cards.map(
    ({ query, data, version, label, role }, index) => {
      const pending = !data && query.isPending;
      const geo = data ? { ...data, ...geoByIp.get(data.ip)?.data } : undefined;
      const classification = data ? typeByIp.get(data.ip) : undefined;
      const company = classification?.data?.coffee;
      const cross = data ? crossByIp.get(data.ip) : undefined;
      const assessment = company
        ? assessQuality(
            company,
            cross?.data ??
              (cross?.isError
                ? { ip: data.ip, readings: [], unavailable: [] }
                : null),
            {
              pending: Boolean(cross?.isFetching && !cross.data),
            },
          )
        : null;
      const score = assessment?.score ?? undefined;
      const hasScore = assessment?.score != null;
      const typeLabels = assessment
        ? [
            {
              label: assessment.kindLabel,
              color:
                assessment.kind === "disputed"
                  ? "bg-amber-500/12 text-foreground"
                  : "bg-primary/5 text-primary",
            },
          ]
        : [];
      const loading =
        pending || Boolean(data && geoByIp.get(data.ip)?.isPending);
      return {
        index,
        role,
        assessment,
        probeStale: Boolean(query.isError),
        stale:
          query.isError || Boolean(classification?.isError || cross?.isError),
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
    },
  );
  const verdictState = assessHomeExits(probes);
  const verdictText =
    verdictState === "pending"
      ? t("正在探测出口…")
      : verdictState === "different"
        ? t("国内与外部探测观察到不同出口。")
        : verdictState === "same"
          ? t("两次探测观察到同一公网出口。")
          : verdictState === "partial"
            ? t("仅取得一侧探测结果，尚不能比较出口。")
            : t("暂未获取到出口地址。");
  const VerdictIcon =
    verdictState === "pending"
      ? LoaderCircle
      : verdictState === "different"
        ? Split
        : verdictState === "same"
          ? ShieldCheck
          : CircleHelp;

  return (
    <div className="home-page">
      <header className="home-hero flex items-start justify-between gap-3 flex-wrap">
        <div className="home-hero-copy min-w-0">
          <p className="home-hero-eyebrow">
            <ScanSearch className="size-3" aria-hidden="true" />
            {t("出口观测")}
          </p>
          <h1 className="home-hero-title">{t("网络概览")}</h1>
          <p className="home-hero-sub">
            {t("双探针对照你的公网出口、归属地与线路质量")}
          </p>
        </div>
        <ActionButton
          size="sm"
          busy={refreshing}
          onClick={refresh}
          className="shrink-0"
        >
          {refreshing ? t("检测中...") : t("重新检测")}
        </ActionButton>
      </header>
      <p className="home-verdict" data-state={verdictState}>
        <VerdictIcon className="home-verdict-icon" aria-hidden="true" />
        <span className="min-w-0">{verdictText}</span>
      </p>
      <SplitTunnelVisualizer
        isSplit={cards.length > 1}
        cardsData={cardsData}
        domesticIp={domesticCard?.data?.ip}
        domesticGeo={domesticGeo}
        domesticPending={probes[0].isFetching}
        overseasIp={overseasCard?.data?.ip}
        overseasGeo={overseasGeo}
        overseasPending={probes[1].isFetching}
      />
    </div>
  );
}

export default HomePage;
