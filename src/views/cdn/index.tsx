import { useState } from "react";
import { ActionButton } from "@/components/toolkit";
import { t } from "@/i18n";
import { request } from "@/lib/network";
import { queryKeys } from "@/lib/query-keys";
import { CdnStage } from "@/views/egress/cdn-stage";
import { getBrowserIp, getDomesticIp, getGeo } from "@/views/home/api";
import { useQueries, useQuery } from "@tanstack/react-query";
import { providers } from "./providers";

export default function CdnPage() {
  const [round, setRound] = useState(0);
  const queries = useQueries({
    queries: providers.map((provider) => ({
      queryKey: ["cdn-node-v3", provider.id, round],
      retry: false,
      staleTime: 0,
      refetchOnWindowFocus: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        if (provider.trace || provider.text) {
          const text = await request<string>(
            provider.url,
            { signal, cache: "no-store" },
            "text",
          );
          const node = provider.trace
            ? text.match(/^colo=(.+)$/m)?.[1]?.trim()
            : text.trim();
          if (!node || node.length > 200 || node.includes("<"))
            throw new Error(t("未返回有效节点标识"));
          return { node, cache: "—" };
        }
        const headers = await request<Headers>(
          provider.url,
          { signal, method: "HEAD", cache: "no-store" },
          "headers",
        );
        const values = (provider.headers ?? []).flatMap((key) => {
          const value = headers.get(key);
          if (!value) return [];
          if (key === "xcc") {
            try {
              return [`${key}: ${atob(value)}`];
            } catch {
              return [];
            }
          }
          if (key === "server" && !/bunnycdn-[\w-]+/i.test(value)) return [];
          return [`${key}: ${value}`];
        });
        if (!values.length) throw new Error(t("节点头未公开或跨域受限"));
        return {
          node: values.join(" · "),
          cache:
            headers.get("x-cache") ?? headers.get("cf-cache-status") ?? "—",
        };
      },
    })),
  });
  const busy = queries.some((query) => query.isFetching);
  const overseas = useQuery({
    queryKey: queryKeys.home.browserIp(),
    queryFn: ({ signal }) => getBrowserIp(4, signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const domestic = useQuery({
    queryKey: queryKeys.egress.domestic(),
    queryFn: ({ signal }) => getDomesticIp(signal),
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
  const overseasIp = overseas.data?.ip;
  const domesticIp =
    domestic.data?.ip && domestic.data.ip !== overseasIp
      ? domestic.data.ip
      : undefined;
  const overseasGeo = useQuery({
    queryKey: queryKeys.geo.byIp(overseasIp),
    enabled: Boolean(overseasIp),
    queryFn: ({ signal }) => getGeo(overseasIp!, signal),
    staleTime: 60_000,
    retry: false,
  });
  const domesticGeo = useQuery({
    queryKey: queryKeys.geo.byIp(domesticIp),
    enabled: Boolean(domesticIp),
    queryFn: ({ signal }) => getGeo(domesticIp!, signal),
    staleTime: 60_000,
    retry: false,
  });
  const httpExits = [
    domesticIp
      ? {
          ip: domesticIp,
          ...domestic.data,
          ...domesticGeo.data,
          path: "domestic" as const,
        }
      : undefined,
    overseasIp
      ? {
          ip: overseasIp,
          ...overseas.data,
          ...overseasGeo.data,
          path: "overseas" as const,
        }
      : undefined,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item?.ip));
  const hits = providers.map((provider, index) => ({
    id: provider.id,
    name: provider.name,
    family: provider.family,
    familyLabel: provider.familyLabel,
    path: provider.path,
    website: provider.website,
    url: provider.url,
    node: queries[index].data?.node,
    cache: queries[index].data?.cache,
    loading: queries[index].isFetching,
    error: queries[index].error?.message,
  }));
  return (
    <div className="space-y-3">
      <CdnStage
        hits={hits}
        busy={busy}
        httpExits={httpExits}
        action={
          <ActionButton
            size="sm"
            busy={busy}
            onClick={() => setRound((n) => n + 1)}
          >
            {busy ? t("检测中...") : t("重新检测")}
          </ActionButton>
        }
      />
      <p className="text-xs text-muted-foreground leading-relaxed mt-2">
        {t(
          "每个 HTTP 出口单独一棵子树。国内 CDN 挂在国内出口下，海外 CDN 挂在海外出口下。节点是边缘 POP，不是你的公网 IP。",
        )}
      </p>
    </div>
  );
}
