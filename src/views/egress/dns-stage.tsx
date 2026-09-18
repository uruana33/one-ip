import { useRef, useState, type ReactNode } from "react";
import { CountryFlag } from "@/components/country-flag";
import { NumberTicker } from "@/components/number-ticker";
import { ActionButton, IpText } from "@/components/toolkit";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { t } from "@/i18n";
import { dnsSampleCount, type DnsProgress } from "@/views/dns-exit/api";
import {
  dnsFamily,
  dnsLaneFamilies,
  dnsLaneGroups,
  dnsMemberId,
  dnsSourceId,
  geoFromDns,
  groupDnsLanes,
  parseDnsLeafId,
  splitDnsForest,
  type DnsForestTree,
  type DnsHttpExit,
  type DnsLane,
} from "./dns-lanes";
import {
  DnsExitDescription,
  DnsExitSheet,
  DnsMemberDescription,
  DnsMemberSheet,
  DnsSourceDescription,
  DnsSourceSheet,
  DnsSourceTitle,
  EgressExitTitle,
} from "./dns-sheet";
import { EgressMesh, type MeshLaneView } from "./mesh-stage";
import { FlowStage } from "./stage";

const TONES = [
  "var(--success)",
  "var(--primary)",
  "#a855f7",
  "var(--warning)",
  "#0ea5e9",
  "var(--danger)",
];

function laneTone(lane: DnsLane, exitIndex: number) {
  if (lane.kind === "blocked") return "var(--danger)";
  if (lane.kind === "pending") return "var(--muted-foreground)";
  return TONES[exitIndex % TONES.length];
}

function laneTitle(lane: DnsLane) {
  if (lane.kind === "blocked") return t("探测受阻");
  if (lane.kind === "pending") return t("检测中…");
  if (lane.members.length > 1) return lane.operatorLabel;
  return lane.ip ?? t("未知");
}

function laneMeta(lane: DnsLane) {
  if (lane.kind === "pending") return t("探针还在路上");
  if (lane.kind === "blocked") return t("接口不可读或跨域受限");
  const families = dnsLaneFamilies(lane)
    .map((family) => (family === "ipv4" ? "IPv4" : "IPv6"))
    .join(" / ");
  const extras = [
    families,
    lane.members.length > 1
      ? t("{0} 个解析器", [lane.members.length])
      : lane.operatorLabel,
  ].filter(Boolean);
  return extras.join(" · ") || t("归属信息暂不可用");
}

function findLane(lanes: readonly DnsLane[], ip: string) {
  return lanes.find(
    (lane) => lane.ip === ip || lane.members.some((member) => member.ip === ip),
  );
}

function collectHttpExits(
  provided: readonly DnsHttpExit[] | undefined,
  clients: DnsProgress["clients"] | undefined,
) {
  const seen = new Set<string>();
  const exits: DnsHttpExit[] = [];
  const push = (geo?: DnsHttpExit) => {
    if (!geo?.ip || seen.has(geo.ip)) return;
    seen.add(geo.ip);
    exits.push({ ...geo, path: geo.path });
  };
  for (const geo of provided ?? []) push(geo);
  const nstool = clients?.find((item) => item.sources.includes("NetEase"));
  if (nstool) push({ ...geoFromDns(nstool), path: "domestic" });
  if (!exits.length) {
    for (const client of clients ?? []) push(geoFromDns(client));
  }
  exits.sort((left, right) => {
    const rank = (item: DnsHttpExit) =>
      item.path === "domestic" || item.country_code === "CN" ? 1 : 0;
    return rank(right) - rank(left);
  });
  return exits;
}

function HttpOriginLabel({ exits }: { exits: readonly DnsHttpExit[] }) {
  if (!exits.length) return t("本机");
  const exit = exits[0];
  return (
    <span className="egress-flow-you-ip">
      <CountryFlag code={exit.country_code} />
      <IpText ip={exit.ip} link={false} />
    </span>
  );
}

function DnsTreeMesh({
  tree,
  layout,
  toneFrom,
  busy,
  onSelectIp,
  onSelectSite,
}: {
  tree: DnsForestTree;
  layout: "grid" | "wrap";
  toneFrom: number;
  busy: boolean;
  onSelectIp: (ip: string) => void;
  onSelectSite: (id: string) => void;
}) {
  const origin = tree.origin;
  return (
    <EgressMesh
      layout={layout}
      originLabel={<HttpOriginLabel exits={origin?.ip ? [origin] : []} />}
      originHint={
        origin?.ip
          ? [t(tree.hint), origin.country, origin.isp]
              .filter(Boolean)
              .join(" · ")
          : busy
            ? t("正在读取出口 IP")
            : t(tree.hint)
      }
      lanes={toMeshLanes(tree.lanes, toneFrom)}
      onSelectIp={onSelectIp}
      onSelectSite={onSelectSite}
      empty={
        <p className="egress-flow-empty">
          {busy
            ? t("查询包正在离开本机…")
            : t("开始检测后，解析器会在这里亮起来。")}
        </p>
      }
    />
  );
}

function toMeshLanes(lanes: readonly DnsLane[], toneFrom = 0): MeshLaneView[] {
  return lanes.map((lane, index) => ({
    key: lane.key,
    kind: lane.kind,
    ip: lane.ip,
    geo: lane.geo,
    family: lane.family,
    tone: laneTone(lane, toneFrom + index),
    title: laneTitle(lane),
    titleMode: lane.members.length > 1 ? "text" : "ip",
    meta: laneMeta(lane),
    count: (
      <>
        {lane.kind === "exit" || lane.kind === "blocked" ? (
          <>
            {lane.samples} {t("次")}
          </>
        ) : (
          t("检测中…")
        )}
      </>
    ),
    groups: dnsLaneGroups(lane).map((group) => ({
      key: group.key,
      label: t(group.label),
      sites:
        lane.kind === "exit"
          ? group.members.map((member) => ({
              id: dnsMemberId(lane.key, group.key, member.ip),
              name: member.ip,
              kind: "ip" as const,
            }))
          : group.sources.map((source) => ({
              id: dnsSourceId(lane.key, group.key, source.name),
              name: source.name,
              website: source.meta.website,
            })),
    })),
    packets: lane.kind === "exit" || lane.kind === "pending" ? 1 : 0,
  }));
}

export function DnsStage({
  state,
  busy,
  httpExits,
  action,
}: {
  state?: DnsProgress;
  busy: boolean;
  httpExits?: DnsHttpExit[];
  action?: ReactNode;
}) {
  const [detailIp, setDetailIp] = useState<string | null>(null);
  const [detailLeaf, setDetailLeaf] = useState<string | null>(null);
  const lanes = groupDnsLanes(state, busy);
  const exits = lanes.filter((lane) => lane.kind === "exit");
  const originExits = collectHttpExits(httpExits, state?.clients);
  const trees = splitDnsForest(lanes, originExits, busy);
  const forest = trees.length > 1;
  const addressCount = exits.reduce(
    (total, lane) => total + lane.members.length,
    0,
  );
  const selectedLane = detailIp ? findLane(lanes, detailIp) : undefined;
  const parsedLeaf = detailLeaf ? parseDnsLeafId(detailLeaf) : undefined;
  const leafLane = parsedLeaf
    ? lanes.find((lane) => lane.key === parsedLeaf.laneKey)
    : undefined;
  const selectedSource =
    parsedLeaf?.kind === "source"
      ? leafLane?.sources.find((source) => source.name === parsedLeaf.name)
      : undefined;
  const selectedMember =
    parsedLeaf?.kind === "member"
      ? leafLane?.members.find((member) => member.ip === parsedLeaf.ip)
      : undefined;
  const sourceMembers =
    selectedSource && leafLane
      ? leafLane.members.filter((member) => {
          if (!member.sources.includes(selectedSource.name)) return false;
          if (
            parsedLeaf?.groupKey === "ipv4" ||
            parsedLeaf?.groupKey === "ipv6"
          )
            return dnsFamily(member.ip) === parsedLeaf.groupKey;
          return true;
        })
      : [];
  const sheet = selectedMember
    ? { kind: "member" as const, member: selectedMember, lane: leafLane }
    : selectedSource
      ? {
          kind: "source" as const,
          source: selectedSource,
          lane: leafLane,
          members: sourceMembers,
          groupKey: parsedLeaf?.groupKey,
          blocked: leafLane?.kind === "blocked",
        }
      : selectedLane
        ? { kind: "exit" as const, lane: selectedLane }
        : null;
  const heldSheet = useRef(sheet);
  if (sheet) heldSheet.current = sheet;
  const view = sheet ?? heldSheet.current;
  const progress = Math.min(1, (state?.count ?? 0) / dnsSampleCount);
  const verdict =
    addressCount > 1
      ? t("解析走到了不同出口")
      : addressCount === 1
        ? t("解析走同一出口")
        : busy
          ? t("正在询问解析器")
          : t("还没有读到 DNS 出口");

  return (
    <FlowStage className="egress-flow egress-dns cyber-cockpit-card hud-frame">
      <div className="egress-flow-toolbar">
        <div className="egress-flow-kicker">
          <span
            className="egress-flow-verdict"
            data-state={
              addressCount > 1
                ? "split"
                : addressCount === 1
                  ? "single"
                  : "wait"
            }
          >
            <span className="egress-flow-verdict-dot" />
            {verdict}
          </span>
          <p className="egress-flow-lead">
            {t(
              "每个 HTTP 出口单独一棵子树。国内探测挂在国内出口下，海外探测挂在海外出口下。",
            )}
          </p>
        </div>
        {action ? <div className="egress-flow-actions">{action}</div> : null}
      </div>
      <div
        className="egress-dns-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={dnsSampleCount}
        aria-valuenow={state?.count ?? 0}
        aria-label={t("DNS 采样进度")}
      >
        <span
          className="egress-dns-meter-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <ul className="egress-flow-stats">
        <li>
          <NumberTicker value={exits.length} />
          <span>{t("条出口")}</span>
        </li>
        <li>
          <NumberTicker value={addressCount} />
          <span>{t("个地址")}</span>
        </li>
        <li>
          <NumberTicker value={state?.count ?? 0} />
          <span>
            /{dnsSampleCount} {t("次采样")}
          </span>
        </li>
        <li>
          <NumberTicker value={state?.failed ?? 0} />
          <span>{t("次失败")}</span>
        </li>
      </ul>
      {forest ? (
        <div className="egress-dns-forest">
          {trees.map((tree, index) => (
            <section
              key={tree.key}
              className="egress-dns-tree"
              data-path={tree.key}
            >
              <DnsTreeMesh
                tree={tree}
                layout="wrap"
                toneFrom={index * 3}
                busy={busy}
                onSelectIp={(ip) => {
                  setDetailLeaf(null);
                  setDetailIp(ip);
                }}
                onSelectSite={(id) => {
                  setDetailIp(null);
                  setDetailLeaf(id);
                }}
              />
            </section>
          ))}
        </div>
      ) : trees[0] ? (
        <DnsTreeMesh
          tree={trees[0]}
          layout="grid"
          toneFrom={0}
          busy={busy}
          onSelectIp={(ip) => {
            setDetailLeaf(null);
            setDetailIp(ip);
          }}
          onSelectSite={(id) => {
            setDetailIp(null);
            setDetailLeaf(id);
          }}
        />
      ) : null}
      <ResponsiveDialog
        className="egress-sheet-dialog"
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailIp(null);
            setDetailLeaf(null);
          }
        }}
        title={
          view?.kind === "member" ? (
            <EgressExitTitle
              ip={view.member.ip}
              geo={geoFromDns(view.member)}
            />
          ) : view?.kind === "source" ? (
            <DnsSourceTitle source={view.source} />
          ) : view?.kind === "exit" ? (
            <EgressExitTitle
              ip={view.lane.ip ?? view.lane.operatorLabel}
              geo={view.lane.geo}
            />
          ) : (
            t("DNS 出口")
          )
        }
        description={
          view?.kind === "member" ? (
            <DnsMemberDescription
              member={view.member}
              operatorLabel={view.lane?.operatorLabel}
            />
          ) : view?.kind === "source" ? (
            <DnsSourceDescription
              source={view.source}
              groupLabel={
                view.groupKey === "ipv4"
                  ? "IPv4"
                  : view.groupKey === "ipv6"
                    ? "IPv6"
                    : undefined
              }
              blocked={view.blocked}
            />
          ) : view?.kind === "exit" ? (
            <DnsExitDescription lane={view.lane} />
          ) : null
        }
      >
        {view?.kind === "member" ? (
          <DnsMemberSheet
            key={view.member.ip}
            member={view.member}
            lane={view.lane}
          />
        ) : view?.kind === "source" ? (
          <DnsSourceSheet
            key={view.source.name}
            source={view.source}
            lane={view.lane}
            members={view.members}
            blocked={view.blocked}
          />
        ) : view?.kind === "exit" ? (
          <DnsExitSheet
            key={view.lane.key}
            lane={view.lane}
            onSelectSource={(name) => {
              const group =
                dnsLaneGroups(view.lane).find((item) =>
                  item.sources.some((source) => source.name === name),
                )?.key ?? "source";
              setDetailIp(null);
              setDetailLeaf(dnsSourceId(view.lane.key, group, name));
            }}
          />
        ) : null}
      </ResponsiveDialog>
    </FlowStage>
  );
}

export function DnsRetryButton({
  busy,
  onClick,
}: {
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <ActionButton size="sm" busy={busy} onClick={onClick}>
      {busy ? t("检测中...") : t("重新检测")}
    </ActionButton>
  );
}
