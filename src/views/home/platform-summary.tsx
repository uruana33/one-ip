import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SiteLogo } from "@/components/site-logo";
import { Pending } from "@/components/toolkit";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UnderlineHover } from "@/components/underline-hover";
import { useSortAnimation } from "@/hooks/use-sort-animation";
import { t } from "@/i18n";
import { queryKeys } from "@/lib/query-keys";
import { aiPlatforms } from "@/views/ai/platforms";
import { probeAiDomain } from "@/views/ai/probe";
import { getStatus } from "@/views/status/api";
import { statusOrder } from "@/views/status/order";
import rawservices from "@/views/status/services.json";
import { useQueries } from "@tanstack/react-query";

const services = rawservices.map((item) => ({
  ...item,
  name: t(item.name),
  note: item.note ? t(item.note) : item.note,
}));

const featured = ["9", "4", "10", "5", "0", "19", "15", "1"].map((id) =>
  services.find((service) => service.id === id)!,
);
const statusLabels: Record<string, string> = {
  none: t("正常运行"),
  minor: t("轻微故障"),
  major: t("严重故障"),
  critical: t("重大故障"),
  maintenance: t("维护中"),
};
export function PlatformSummary() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const connectivity = useQueries({
    queries: aiPlatforms.map((platform) => ({
      queryKey: queryKeys.ai.preview(platform.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        probeAiDomain(platform.domain, signal),
      enabled: visible,
      staleTime: 120_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const statuses = useQueries({
    queries: featured.map((service) => ({
      queryKey: queryKeys.status.service(service.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        getStatus(service.id, signal),
      enabled: visible,
      staleTime: 120_000,
      retry: false,
      refetchOnWindowFocus: false,
    })),
  });
  const orderedPlatforms = aiPlatforms.map((platform, index) => ({
    platform,
    query: connectivity[index],
  }));
  if (
    connectivity.every(
      (query) => !query.isFetching && (query.isSuccess || query.isError),
    )
  )
    orderedPlatforms.sort((a, b) => {
      const left = a.query.data?.median;
      const right = b.query.data?.median;
      return (
        (left != null && left >= 0 ? left : Infinity) -
        (right != null && right >= 0 ? right : Infinity)
      );
    });
  const sortRef = useSortAnimation(
    orderedPlatforms.map(({ platform }) => platform.id).join("|"),
  );
  return (
    <div ref={ref} className="grid grid-cols-1 gap-3.5 mb-3 md:grid-cols-2">
      <Card className="cyber-card">
        <CardHeader>
          <CardTitle>{t("AI 访问概览")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={sortRef} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {orderedPlatforms.map(({ platform, query }) => {
              const latency = query.data?.median;
              return (
                <div
                  key={platform.id}
                  data-sort-id={platform.id}
                  className="group flex min-w-0 items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/40 transition-[border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 text-xs"
                >
                  <UnderlineHover asChild>
                    <Link
                      to={`/ai/${platform.id}`}
                      className="flex min-w-0 items-center gap-2 text-foreground"
                      style={{ display: "flex" }}
                    >
                      <SiteLogo
                        website={`https://${platform.domain}`}
                        className="size-4 shrink-0 rounded-sm"
                      />
                      <span className="truncate font-medium">
                        {platform.name}
                      </span>
                    </Link>
                  </UnderlineHover>
                  <span
                    className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border border-current/20 shrink-0"
                    title={query.data?.description}
                    style={{
                      color: query.isPending
                        ? "var(--muted-foreground)"
                        : latency == null || latency < 0
                          ? "var(--danger)"
                          : latency < 100
                            ? "var(--success)"
                            : latency < 400
                              ? "#0284c7"
                              : "var(--warning)",
                      backgroundColor: query.isPending
                        ? "transparent"
                        : latency == null || latency < 0
                          ? "color-mix(in srgb, var(--danger) 10%, transparent)"
                          : latency < 100
                            ? "color-mix(in srgb, var(--success) 10%, transparent)"
                            : latency < 400
                              ? "color-mix(in srgb, #0284c7 10%, transparent)"
                              : "color-mix(in srgb, var(--warning) 10%, transparent)",
                    }}
                  >
                    {query.isPending ? (
                      <Pending>{t("待检测")}</Pending>
                    ) : latency == null || latency < 0 ? (
                      query.data?.status === "restricted" ? (
                        t("检测受限")
                      ) : (
                        t("未连通")
                      )
                    ) : (
                      `${latency} ms`
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="home-note mt-3 text-[11px] text-muted-foreground">
            {t(
              "显示本次探测资源的 HTTP 响应耗时；未连通表示本次探测失败。点击平台可查看详情并打开官网。",
            )}
          </p>
        </CardContent>
      </Card>
      <Card className="cyber-card">
        <CardHeader>
          <div className="row-between">
            <CardTitle>{t("服务状态")}</CardTitle>
            <UnderlineHover asChild>
              <Link
                to="/status"
                className="small muted hover:text-primary transition-colors"
              >
                {t("全部服务 ›")}
              </Link>
            </UnderlineHover>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {featured
              .map((service, index) => ({ service, query: statuses[index] }))
              .sort(
                (a, b) =>
                  statusOrder(a.query.data?.status?.indicator) -
                  statusOrder(b.query.data?.status?.indicator),
              )
              .map(({ service, query }) => {
                const indicator = query.data?.status?.indicator;
                const isGood = indicator === "none";
                return (
                  <div
                    key={service.id}
                    className="group flex min-w-0 items-center justify-between gap-2 p-2 rounded-xl bg-muted/40 hover:bg-muted/80 border border-border/50 hover:border-primary/40 transition-[border-color,background-color,transform] duration-200 ease-out hover:-translate-y-0.5 text-xs"
                  >
                    <UnderlineHover asChild>
                      <Link
                        to={`/status?service=${service.id}`}
                        className="flex min-w-0 items-center gap-2 text-foreground"
                        style={{ display: "flex" }}
                      >
                        <SiteLogo
                          src={service.icon}
                          website={service.page}
                          className="size-4 shrink-0 rounded-sm"
                        />
                        <span className="truncate font-medium">
                          {service.name.replace(" (Anthropic)", "")}
                        </span>
                      </Link>
                    </UnderlineHover>
                    <span
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md border border-current/20 shrink-0"
                      style={{
                        color: !indicator
                          ? "var(--muted-foreground)"
                          : isGood
                            ? "var(--success)"
                            : "var(--danger)",
                        backgroundColor: !indicator
                          ? "transparent"
                          : isGood
                            ? "color-mix(in srgb, var(--success) 10%, transparent)"
                            : "color-mix(in srgb, var(--danger) 10%, transparent)",
                      }}
                    >
                      {indicator && (
                        <span
                          className={`size-1.5 rounded-full ${isGood ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]" : "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)] animate-pulse"}`}
                        />
                      )}
                      {query.isPending ? (
                        <Pending>{t("查询中")}</Pending>
                      ) : (
                        (statusLabels[indicator ?? ""] ?? t("待确认"))
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="home-note mt-3 text-[11px] text-muted-foreground">
            {t("来自官方状态源；点击服务查看组件与事件。")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
