import { useState } from "react";
import { ErrorNotice } from "@/components/toolkit";
import { t } from "@/i18n";
import { queryKeys } from "@/lib/query-keys";
import { DnsRetryButton, DnsStage } from "@/views/egress/dns-stage";
import { getBrowserIp, getDomesticIp, getGeo } from "@/views/home/api";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { detectDnsExits, type DnsProgress } from "./api";

export default function DnsExitPage() {
  const [round, setRound] = useState(0);
  const client = useQueryClient();
  const progressKey = ["dns-exit-progress", round];
  const progress = useQuery<DnsProgress>({
    queryKey: progressKey,
    enabled: false,
    queryFn: skipToken,
  });
  const query = useQuery({
    queryKey: ["dns-exit", round],
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      detectDnsExits(signal, (state) => {
        client.setQueryData(progressKey, state);
      }),
  });
  const state = query.isFetching
    ? progress.data
    : (query.data ?? progress.data);
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
  return (
    <div className="space-y-3">
      <DnsStage
        state={state}
        busy={query.isFetching}
        httpExits={httpExits}
        action={
          <DnsRetryButton
            busy={query.isFetching}
            onClick={() => setRound((n) => n + 1)}
          />
        }
      />
      <ErrorNotice error={query.error} />
      <p className="text-xs text-muted-foreground leading-relaxed mt-2">
        {t(
          "每个 HTTP 出口单独一棵子树。国内探测挂在国内出口下，海外探测挂在海外出口下。",
        )}
      </p>
    </div>
  );
}
