import { ErrorNotice, Pending } from "@/components/toolkit";
import { useLookupHistory } from "@/hooks/use-lookup-history";
import { locale, t } from "@/i18n";
import type { FolioCardItem } from "@/views/lookup/folio-cards";
import { FolioCards } from "@/views/lookup/folio-cards";
import { useQuery } from "@tanstack/react-query";
import type { Registration } from "./api";
import { lookupWhois } from "./api";

export const WHOIS_HISTORY_KEY = "ip-tools:whois-history:v1";

function whoisCards(
  data: Registration["data"],
  source?: string,
): FolioCardItem[] {
  const items: FolioCardItem[] = [];
  const add = (
    label: string,
    value?: string,
    extra?: Partial<FolioCardItem>,
  ) => {
    const text = value?.trim();
    if (!text || text === t("未知")) return;
    items.push({ label, value: text, ...extra });
  };

  add(t("查询协议"), source ? t(source) : undefined);
  add(t("对象类型"), data.objectClassName);
  add(t("标识符"), data.handle);
  add(t("国家 / 地区"), data.country);
  if (data.startAddress) {
    add(
      t("地址范围"),
      `${data.startAddress} – ${data.endAddress ?? data.startAddress}`,
    );
  }
  for (const event of data.events ?? []) {
    add(event.eventAction, new Date(event.eventDate).toLocaleString(locale));
  }
  if (data.status?.length) {
    const status = data.status.join(" · ");
    add(t("域名状态"), status, { wide: status.length > 28 });
  }
  const nameservers = (data.nameservers ?? [])
    .map((server) => server.ldhName)
    .filter((name): name is string => !!name);
  if (nameservers.length) {
    add(t("DNS 服务器"), nameservers.join(" · "), { wide: true });
  }
  data.entities?.forEach((entity, index) => {
    items.push({
      key: `entity-${entity.handle ?? index}`,
      label: entity.roles?.join(" / ") ?? t("注册实体"),
      value: entity.handle ?? t("隐私保护"),
    });
  });
  return items;
}

export default function WhoisPanel({
  query,
  embedded = false,
}: {
  query: string;
  compact?: boolean;
  embedded?: boolean;
  plain?: boolean;
}) {
  const history = useLookupHistory<Registration>(WHOIS_HISTORY_KEY);
  const cached = history.find(query);
  const lookup = useQuery({
    queryKey: ["whois", query],
    enabled: !!query,
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.savedAt,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await lookupWhois(query, signal);
      history.save(query, result);
      return result;
    },
    retry: false,
  });
  const data = lookup.data?.data;
  const items = data ? whoisCards(data, lookup.data?.source) : [];

  return (
    <div className={embedded ? "whois-embedded" : "space-y-3"}>
      <ErrorNotice error={lookup.error} />
      {lookup.isFetching && (
        <p className="status-line">
          <Pending>{t("正在向注册局查询…")}</Pending>
        </p>
      )}
      {data ? (
        <div className="lookup-results">
          {embedded ? null : (
            <h3 className="whois-result-name">
              {data.ldhName ?? data.name ?? query}
            </h3>
          )}
          <FolioCards items={items} />
          <details className="raw-details">
            <summary>{t("查看原始 RDAP 数据")}</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}
