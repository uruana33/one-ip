import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { NumberTicker } from "@/components/number-ticker";
import { SiteLogo } from "@/components/site-logo";
import { PageHeading, Pending } from "@/components/toolkit";
import { Button } from "@/components/ui/button";
import { t, locale } from "@/i18n";
import { queryKeys } from "@/lib/query-keys";
import {
  useQueries,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { getStatus } from "./api";
import type { ServiceStatus } from "./api";
import { statusLoadBatch, statusLoadIds } from "./loading";
import { statusOrder } from "./order";
import {
  presentStatus,
  presentSummary,
  type StatusQuerySnapshot,
} from "./presentation";
import rawservices from "./services.json";

const services = rawservices.map((item) => ({
  ...item,
  name: t(item.name),
  note: item.note ? t(item.note) : item.note,
}));

const GROUP_ORDER = [
  "AI",
  "云服务",
  "网络基础设施",
  "开发",
  "数据服务",
  "监控与安全",
  "消息与邮件",
  "媒体与内容",
  "协作与办公",
  "支付与电商",
  "VPS",
  "社区",
] as const;

const GROUP_SUBTITLE: Record<(typeof GROUP_ORDER)[number], string> = {
  AI: "AI PLATFORMS",
  云服务: "CLOUD & HOSTING",
  网络基础设施: "NETWORK & EDGE",
  开发: "DEV TOOLS",
  数据服务: "DATA SERVICES",
  监控与安全: "OBSERVABILITY & SECURITY",
  消息与邮件: "MESSAGING & EMAIL",
  媒体与内容: "MEDIA & CONTENT",
  协作与办公: "COLLABORATION & WORK",
  支付与电商: "PAYMENTS & COMMERCE",
  VPS: "VPS / SERVERS",
  社区: "COMMUNITY",
};

type ServiceRow = (typeof services)[number] & {
  requested: boolean;
  query: UseQueryResult<ServiceStatus, Error>;
};

function severityRank(row: ServiceRow): number {
  if (!row.url) return 6;
  switch (indicatorOf(row)) {
    case "critical":
      return 0;
    case "major":
      return 1;
    case "minor":
      return 2;
    case "maintenance":
      return 3;
    case "none":
      return 4;
    default:
      return 5;
  }
}

function indicatorOf(row: ServiceRow): string {
  return presentedOf(row).indicator;
}

function statusText(row: ServiceRow): string {
  const presented = presentedOf(row);
  return t(presented.textKey, presented.textValues);
}

function presentedOf(row: ServiceRow) {
  const snapshot: StatusQuerySnapshot = {
    url: row.url,
    requested: row.requested,
    isPending: row.query.isPending,
    isError: row.query.isError,
    isRefetchError: row.query.isRefetchError,
    data: row.query.data,
  };
  return presentStatus(snapshot);
}

function SpectrumBar({ row }: { row: ServiceRow }) {
  const indicator = indicatorOf(row);
  const loading = row.requested && row.url && !row.query.data;
  return (
    <a
      className={`sw-bar sw-${indicator}${loading ? " sw-bar-loading" : ""}`}
      title={`${row.name} — ${statusText(row)}`}
      aria-label={t("前往 {0} 官方状态页", [row.name])}
      href={row.page}
      target="_blank"
      rel="noreferrer"
    />
  );
}

function FlipCard({
  row,
  index,
  focused,
}: {
  row: ServiceRow;
  index: number;
  focused: boolean;
}) {
  const indicator = indicatorOf(row);
  const fetching = row.requested && row.query.isFetching;
  const incidents = row.query.data?.incidents?.length ?? 0;
  const fetchedAt = row.query.data?.fetchedAt;
  return (
    <a
      className={`sw-flip sw-${indicator}${focused ? " sw-flip-focus" : ""}`}
      style={{ animationDelay: `${Math.min(index, 14) * 40}ms` }}
      href={row.page}
      target="_blank"
      rel="noreferrer"
      aria-label={t("前往 {0} 官方状态页", [row.name])}
    >
      <span className="sw-flip-top">
        <i
          className={`sw-block${fetching ? " sw-block-loading" : ""}`}
          aria-hidden="true"
        />
        <SiteLogo
          src={row.icon}
          website={row.page}
          className="size-4 shrink-0 rounded-sm"
        />
        <span className="sw-flip-name" title={row.name}>
          {row.name}
        </span>
        {incidents > 0 && (
          <span className="sw-flip-incidents">
            {incidents}
            {t("个事件")}
          </span>
        )}
      </span>
      <span className="sw-flip-bottom">
        <span className="sw-flip-status">
          {fetching && !row.query.data ? (
            <Pending>{t("查询中…")}</Pending>
          ) : (
            statusText(row)
          )}
        </span>
        <span className="sw-flip-time">
          {fetchedAt
            ? t("读取于 {0}", [
                new Date(fetchedAt).toLocaleTimeString(locale, {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              ])
            : "——"}
        </span>
      </span>
    </a>
  );
}

export default function StatusPage() {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const focusId = params.get("service");
  const focusService = services.find((service) => service.id === focusId);
  const filter = params.get("group") ?? focusService?.group ?? "";
  const loadScope = filter || "全部";
  const loadBatch = statusLoadBatch(
    services,
    (service) => {
      const state = queryClient.getQueryState(
        queryKeys.status.service(service.id),
      );
      return state?.status === "success" || state?.status === "error";
    },
    loadScope,
  );
  const requestedIds = useMemo(
    () => statusLoadIds(services, loadScope, focusId, loadBatch),
    [focusId, loadBatch, loadScope],
  );
  const queries = useQueries({
    queries: services.map((s) => ({
      queryKey: queryKeys.status.service(s.id),
      enabled: Boolean(s.url) && requestedIds.has(s.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => getStatus(s.id, signal),
      retry: false,
      staleTime: 60_000,
      refetchInterval: 120_000,
    })),
  });
  const pending = queries.some(
    (q, index) => requestedIds.has(services[index].id) && q.isFetching,
  );
  const allRows: ServiceRow[] = services.map((service, i) => ({
    ...service,
    requested: requestedIds.has(service.id),
    query: queries[i],
  }));
  const rows: ServiceRow[] = allRows.filter(
    (s) => filter === "" || filter === "全部" || s.group === filter,
  );
  const issueRows = rows
    .filter((row) => statusOrder(indicatorOf(row)) === 0)
    .sort((a, b) => severityRank(a) - severityRank(b));
  const summary = presentSummary(
    rows.map((row) => ({
      url: row.url,
      requested: row.requested,
      isPending: row.query.isPending,
      isError: row.query.isError,
      isRefetchError: row.query.isRefetchError,
      data: row.query.data,
    })),
  );
  const { healthyCount, unknownCount } = summary;
  useEffect(() => {
    document.title = t("AI 与云服务官方状态 · 出口观测台");
  }, []);
  const groups = GROUP_ORDER.map((group) => ({
    group,
    items: allRows
      .filter((row) => row.group === group)
      .sort((a, b) => severityRank(a) - severityRank(b)),
  })).filter(({ items }) => items.length > 0);

  return (
    <div className="status-wall">
      <PageHeading
        title={t("服务状态")}
        description={t(
          "优先读取官方状态；无官方状态页时降级为可达性参考，并明确标注「仅供参考」。",
        )}
      />
      <section className="sw-hero">
        <div className="sw-hero-top">
          <h2
            className={`sw-hero-state${issueRows.length > 0 ? " sw-hero-state-alert" : ""}`}
          >
            {t(summary.headlineKey, [
              summary.headlineKey === "{0} 个服务需要关注"
                ? issueRows.length
                : unknownCount,
            ])}
          </h2>
          <div className="sw-hero-counts">
            <span className="sw-count sw-count-ok">
              <NumberTicker value={healthyCount} />
              <em>{t("运行中")}</em>
            </span>
            <span className="sw-count-sep" aria-hidden="true">
              /
            </span>
            <span className="sw-count sw-count-issue">
              <NumberTicker value={issueRows.length} />
              <em>{t("异常")}</em>
            </span>
            <span className="sw-count-sep" aria-hidden="true">
              /
            </span>
            <span className="sw-count sw-count-unknown">
              <NumberTicker value={unknownCount} />
              <em>{t("未知")}</em>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              aria-busy={pending}
              onClick={() => {
                void Promise.all(
                  queries
                    .filter(
                      (_, index) =>
                        services[index].url &&
                        requestedIds.has(services[index].id),
                    )
                    .map((q) => q.refetch()),
                );
              }}
            >
              {pending ? <Pending>{t("刷新中…")}</Pending> : t("刷新状态")}
            </Button>
          </div>
        </div>
        <div className="sw-strip" role="list" aria-label={t("服务状态总览")}>
          {rows.map((row) => (
            <SpectrumBar key={row.id} row={row} />
          ))}
        </div>
        <div className="sw-legend">
          <span className="sw-legend-item">
            <i className="sw-block sw-none" aria-hidden="true" />
            {t("正常运行")}
          </span>
          <span className="sw-legend-item">
            <i className="sw-block sw-minor" aria-hidden="true" />
            {t("轻微 / 维护")}
          </span>
          <span className="sw-legend-item">
            <i className="sw-block sw-major" aria-hidden="true" />
            {t("严重故障")}
          </span>
          <span className="sw-legend-item">
            <i className="sw-block sw-unknown" aria-hidden="true" />
            {t("待确认")}
          </span>
          <span className="sw-legend-item">
            <i className="sw-block sw-none-integrated" aria-hidden="true" />
            {t("未接入")}
          </span>
        </div>
      </section>
      <div className="sw-toolbar">
        <button
          type="button"
          className={`sw-all-chip${filter === "全部" ? " sw-all-chip-on" : ""}`}
          onClick={() => setParams(filter === "全部" ? {} : { group: "全部" })}
          aria-pressed={filter === "全部"}
        >
          {filter === "全部" ? t("全部收起") : t("全部展开")}
        </button>
        <span className="sw-toolbar-hint">{t("点击卡片展开对应分组")}</span>
      </div>
      {issueRows.length > 0 && (
        <div className="sw-alert" role="alert">
          <span className="sw-alert-tag">{t("告警")}</span>
          <span className="sw-alert-items">
            {issueRows.map((row, index) => (
              <span key={row.id} className="sw-alert-item">
                {index > 0 && (
                  <span className="sw-alert-sep" aria-hidden="true">
                    ·
                  </span>
                )}
                <a href={row.page} target="_blank" rel="noreferrer">
                  {row.name}
                </a>
                <em>{statusText(row)}</em>
              </span>
            ))}
          </span>
        </div>
      )}
      <div className="sw-groups">
        {groups.map(({ group, items }) => {
          const issueCount = items.filter(
            (row) => statusOrder(indicatorOf(row)) === 0,
          ).length;
          const expanded = filter === "全部" || filter === group;
          const worst = items.length
            ? indicatorOf(
                items.reduce((a, b) =>
                  severityRank(a) <= severityRank(b) ? a : b,
                ),
              )
            : "unknown";
          return (
            <section
              className={`sw-card${expanded ? " sw-card-open" : ""}`}
              key={group}
            >
              <button
                type="button"
                className="sw-card-head"
                aria-expanded={expanded}
                aria-label={t("{0} 服务列表", [t(group)])}
                onClick={() => setParams(filter === group ? {} : { group })}
              >
                <span className="sw-card-id">
                  <i
                    className={`sw-block sw-card-dot sw-${worst}`}
                    aria-hidden="true"
                  />
                  <span className="sw-card-name">{t(group)}</span>
                  <span className="sw-card-sub">{GROUP_SUBTITLE[group]}</span>
                </span>
                <span className="sw-card-meta">
                  {items.length}
                  {t("个服务")}
                  {issueCount > 0 && (
                    <em className="sw-card-issues">
                      {t("{0} 个异常", [issueCount])}
                    </em>
                  )}
                </span>
                <span className="sw-mini-strip" aria-hidden="true">
                  {items.map((row) => (
                    <i
                      key={row.id}
                      className={`sw-mini-bar sw-${indicatorOf(row)}`}
                    />
                  ))}
                </span>
                <span className="sw-card-chevron" aria-hidden="true">
                  ▸
                </span>
              </button>
              <div className="sw-card-body">
                <div className="sw-card-body-inner">
                  {items.map((row, index) => (
                    <FlipCard
                      key={row.id}
                      row={row}
                      index={index}
                      focused={row.id === focusId}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <p className="small muted">
        {t("每 2 分钟自动检查。未知或查询失败不等于服务故障。")}
      </p>
    </div>
  );
}
