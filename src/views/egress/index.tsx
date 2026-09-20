import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PrivacyToggle } from "@/components/toolkit";
import { AnimatedSegmentedTabs } from "@/components/ui/animated-segmented-tabs";
import { t } from "@/i18n";
import CdnPanel from "@/views/cdn";
import DnsExitPanel from "@/views/dns-exit";
import { SplitResults } from "@/views/home/split-results";
import { Tabs } from "radix-ui";

type TabValue = "exits" | "dns" | "cdn";

const tabs = [
  { value: "exits", label: t("分流出口") },
  { value: "dns", label: t("DNS 出口") },
  { value: "cdn", label: t("CDN 节点") },
] as const;

function resolveTab(value: string | null): TabValue {
  return value === "dns" || value === "cdn" ? value : "exits";
}

/**
 * One observation deck for everything about the reader's own egress: which
 * IPs the traffic leaves from, where DNS leaks out, and which CDN edges
 * answer. Previously three sibling pages with near-identical names.
 */
export default function EgressPage() {
  const [params, setParams] = useSearchParams();
  const tab = resolveTab(params.get("tab"));

  useEffect(() => {
    document.title = t("出口检测 - IP 网络工具");
  }, []);

  return (
    <div className="space-y-3">
      <header className="page-header">
        <div className="page-header-text">
          <h1>{t("出口检测")}</h1>
          <p>
            {t(
              "看流量从本机走到哪条公网 IP。颜色相同就是同一条出口；DNS 和 CDN 是另外两条路径。",
            )}
          </p>
        </div>
        <PrivacyToggle />
      </header>
      <AnimatedSegmentedTabs<TabValue>
        label={t("出口检测分组")}
        options={tabs}
        value={tab}
        onValueChange={(next) =>
          setParams(next === "exits" ? {} : { tab: next }, { replace: true })
        }
        className="ip-dossier-tabs"
        listClassName="w-full"
      >
        {/*
          Inactive panels unmount, so DNS and CDN probes never fire until the
          reader opens their tab.
        */}
        <Tabs.Content value="exits" className="ip-dossier-panel">
          <SplitResults />
        </Tabs.Content>
        <Tabs.Content value="dns" className="ip-dossier-panel">
          <DnsExitPanel />
        </Tabs.Content>
        <Tabs.Content value="cdn" className="ip-dossier-panel">
          <CdnPanel />
        </Tabs.Content>
      </AnimatedSegmentedTabs>
    </div>
  );
}
