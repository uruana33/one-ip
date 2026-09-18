import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CountryFlag } from "@/components/country-flag";
import { IpText, Pending, ActionButton } from "@/components/toolkit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { t } from "@/i18n";
import type { DiagnosticResult } from "@/lib/diagnostics";
import { queryKeys } from "@/lib/query-keys";
import type { Geo } from "@/lib/types";
import { EgressFlowBoard } from "@/views/egress/flow-board";
import {
  EgressExitDescription,
  EgressExitSheet,
  EgressExitTitle,
  EgressSiteDescription,
  EgressSiteSheet,
  EgressSiteTitle,
} from "@/views/egress/site-sheet";
import { useQueries } from "@tanstack/react-query";
import { detectSiteResult, getGeo } from "./api";
import { sourceRegistry, type SourceDefinition } from "./source-registry";

const allSites = sourceRegistry.map((item) => ({
  ...item,
  name: t(item.name),
}));
const allSiteIds = allSites.map((site) => site.id);
const initialSites = allSites
  .filter(
    (site) => site.enabledByDefault && site.execution === "client-request",
  )
  .slice(0, 8);
const initialSiteIds = new Set(initialSites.map((site) => site.id));

type Row = SourceDefinition & {
  visible: boolean;
  geo?: Geo;
  diagnostic?: DiagnosticResult;
  pending: boolean;
  geoPending: boolean;
};
export function SplitResults({ summary = false }: { summary?: boolean }) {
  const sites = summary ? initialSites : allSites;
  const [round, setRound] = useState(0);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailIp, setDetailIp] = useState<string | null>(null);
  const runId = `split-${round}`;
  const [visibleSites, setVisibleSites] = useState<Set<string>>(() =>
    summary ? new Set() : new Set(allSiteIds),
  );
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!summary || !container.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setVisibleSites(new Set(initialSiteIds));
        observer.disconnect();
      }
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [summary]);
  const queries = useQueries({
    queries: sites.map((site) => ({
      queryKey: queryKeys.home.split(site.id, round),
      enabled: visibleSites.has(site.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        detectSiteResult(site, runId, signal),
      staleTime: 60_000,
      retry: false,
    })),
  });
  const ips = [
    ...new Set(
      [
        ...queries.filter((_, index) => visibleSites.has(sites[index].id)),
      ].flatMap((query) =>
        query.data?.status === "ok" && query.data.ip ? [query.data.ip] : [],
      ),
    ),
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
  const rows: Row[] = sites.map((site, i) => ({
    ...site,
    visible: visibleSites.has(site.id),
    diagnostic: queries[i].data,
    geo:
      visibleSites.has(site.id) &&
      queries[i].data?.status === "ok" &&
      queries[i].data.ip
        ? {
            ip: queries[i].data.ip,
            source: site.name,
            ...geoByIp.get(queries[i].data.ip)?.data,
          }
        : undefined,
    pending:
      visibleSites.has(site.id) &&
      (queries[i].isFetching || queries[i].isPending),
    geoPending:
      visibleSites.has(site.id) &&
      (queries[i].isPending ||
        Boolean(
          queries[i].data?.status === "ok" &&
          queries[i].data.ip &&
          geoByIp.get(queries[i].data.ip)?.isPending,
        )),
  }));
  rows.sort((a, b) => {
    const aBlocked = a.visible && !a.pending && !a.geo;
    const bBlocked = b.visible && !b.pending && !b.geo;
    return Number(bBlocked) - Number(aBlocked);
  });
  const exits = [
    ...new Map(
      rows.flatMap((row) => (row.geo ? [[row.geo.ip, row.geo] as const] : [])),
    ).values(),
  ];
  const detail = rows.find((row) => row.id === detailId);
  const exitRows = detailIp
    ? rows.filter((row) => row.geo?.ip === detailIp)
    : [];
  const exitGeo = exitRows[0]?.geo;
  const sheet = detail
    ? {
        kind: "site" as const,
        site: detail,
        siblingCount: detail.geo?.ip
          ? rows.filter((row) => row.geo?.ip === detail.geo?.ip).length
          : 0,
      }
    : detailIp
      ? {
          kind: "exit" as const,
          ip: detailIp,
          geo: exitGeo,
          sites: exitRows,
        }
      : null;
  const heldSheet = useRef(sheet);
  if (sheet) heldSheet.current = sheet;
  const view = sheet ?? heldSheet.current;
  const pending = queries.some((q) => q.isFetching);
  const Container = summary ? Card : "div";
  const Content = summary ? CardContent : "div";
  return (
    <Container ref={container} className="mb-3">
      {summary && (
        <CardHeader>
          <div className="row-between">
            <CardTitle>{t("网站分流出口")}</CardTitle>
            {summary && (
              <Link className="small muted" to="/network/egress">
                {t("查看全部 ›")}
              </Link>
            )}
          </div>
        </CardHeader>
      )}
      <Content>
        {!summary && (
          <EgressFlowBoard
            rows={rows}
            total={sites.length}
            pending={pending}
            onSelectIp={setDetailIp}
            onSelectSite={setDetailId}
            action={
              <ActionButton
                busy={pending}
                onClick={() => {
                  setDetailId(null);
                  setDetailIp(null);
                  setVisibleSites(new Set(allSiteIds));
                  setRound((value) => value + 1);
                }}
              >
                {pending ? t("检测中...") : t("重新检测")}
              </ActionButton>
            }
          />
        )}
        {summary ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {exits.map((geo) => {
                const count = rows.filter(
                  (row) => row.geo?.ip === geo.ip,
                ).length;
                const location = [geo.country, geo.city]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div
                    key={geo.ip}
                    className="group relative flex items-center justify-between gap-2.5 rounded-xl border border-border/60 bg-card/60 p-2.5 backdrop-blur-sm transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out hover:border-primary/40 hover:bg-card hover:shadow-sm hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CountryFlag code={geo.country_code} />
                      <div className="flex flex-col min-w-0 text-left">
                        <div className="font-mono text-xs font-semibold tracking-tight text-foreground truncate">
                          <IpText ip={geo.ip} />
                        </div>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {location || geo.isp || "—"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-medium transition-colors cursor-pointer"
                      onClick={() => {
                        setDetailId(null);
                        setDetailIp(geo.ip);
                      }}
                    >
                      <span>
                        {count} {t("个站点")}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
              {pending ? (
                <Pending>{t("正在检测分流出口…")}</Pending>
              ) : (
                <span>
                  {t("已读取 {0}/{1} 个站点的出口{2}", [
                    rows.filter((row) => row.geo).length,
                    sites.length,
                    !exits.length ? t("，暂无可显示结果") : "",
                  ])}
                </span>
              )}
              <Link
                to="/network/egress"
                className="text-primary hover:underline inline-flex items-center gap-1 text-[11px]"
              >
                {t("查看全部 ›")}
              </Link>
            </div>
          </div>
        ) : null}
      </Content>
      <ResponsiveDialog
        className="egress-sheet-dialog"
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailId(null);
            setDetailIp(null);
          }
        }}
        title={
          view?.kind === "site" ? (
            <EgressSiteTitle site={view.site} />
          ) : view?.kind === "exit" ? (
            <EgressExitTitle ip={view.ip} geo={view.geo} />
          ) : (
            t("出口站点")
          )
        }
        description={
          view?.kind === "site" ? (
            <EgressSiteDescription site={view.site} />
          ) : view?.kind === "exit" ? (
            <EgressExitDescription geo={view.geo} count={view.sites.length} />
          ) : null
        }
      >
        {view?.kind === "site" ? (
          <EgressSiteSheet
            key={view.site.id}
            site={view.site}
            siblingCount={view.siblingCount}
            onSelectExit={(ip) => {
              setDetailId(null);
              setDetailIp(ip);
            }}
          />
        ) : view?.kind === "exit" ? (
          <EgressExitSheet
            key={view.ip}
            ip={view.ip}
            sites={view.sites}
            onSelectSite={setDetailId}
          />
        ) : null}
      </ResponsiveDialog>
    </Container>
  );
}
