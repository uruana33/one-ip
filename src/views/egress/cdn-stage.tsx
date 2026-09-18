import { useRef, useState, type ReactNode } from "react";
import { CountryFlag } from "@/components/country-flag";
import { NumberTicker } from "@/components/number-ticker";
import { ActionButton, IpText } from "@/components/toolkit";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { t } from "@/i18n";
import {
  cdnLaneGroups,
  cdnLeafKind,
  cdnMemberId,
  cdnNodeLabel,
  groupCdnLanes,
  parseCdnLeafId,
  splitCdnForest,
  type CdnForestTree,
  type CdnHit,
  type CdnLane,
} from "./cdn-lanes";
import {
  CdnFamilyDescription,
  CdnFamilySheet,
  CdnFamilyTitle,
  CdnMemberDescription,
  CdnMemberSheet,
  CdnMemberTitle,
} from "./cdn-sheet";
import type { DnsHttpExit } from "./dns-lanes";
import { dnsHttpPath } from "./dns-lanes";
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

function laneTone(lane: CdnLane, exitIndex: number) {
  if (lane.kind === "blocked") return "var(--danger)";
  if (lane.kind === "pending") return "var(--muted-foreground)";
  return TONES[exitIndex % TONES.length];
}

function laneTitle(lane: CdnLane) {
  if (lane.family === "pending") return t("检测中…");
  return lane.familyLabel;
}

function laneMeta(lane: CdnLane) {
  if (lane.kind === "pending") return t("探针还在路上");
  if (lane.kind === "blocked") return t("头未公开");
  return lane.members.length > 1
    ? t("{0} 座节点", [lane.samples])
    : lane.members[0]?.node
      ? cdnNodeLabel(lane.members[0].node)
      : t("边缘节点");
}

function collectHttpExits(provided: readonly DnsHttpExit[] | undefined) {
  const seen = new Set<string>();
  const exits: DnsHttpExit[] = [];
  for (const geo of provided ?? []) {
    if (!geo?.ip || seen.has(geo.ip)) continue;
    seen.add(geo.ip);
    exits.push({ ...geo, path: dnsHttpPath(geo) });
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

function toMeshLanes(lanes: readonly CdnLane[], toneFrom = 0): MeshLaneView[] {
  return lanes.map((lane, index) => ({
    key: lane.key,
    kind: lane.kind,
    selectKey: lane.key,
    logo: lane.website || undefined,
    family: lane.family,
    tone: laneTone(lane, toneFrom + index),
    title: laneTitle(lane),
    titleMode: "text" as const,
    meta: laneMeta(lane),
    count: (
      <>
        {lane.kind === "pending" ? (
          t("检测中…")
        ) : (
          <>
            {lane.samples} {t("座")}
          </>
        )}
      </>
    ),
    groups: cdnLaneGroups(lane).map((group) => ({
      key: group.key,
      label: t(group.label),
      sites: group.members.map((member) => ({
        id: cdnMemberId(lane.key, group.key, member.id),
        name:
          group.key === "colo" && member.node
            ? cdnNodeLabel(member.node)
            : member.name,
        website: member.website,
        kind:
          group.key === "colo"
            ? cdnLeafKind(member.node ? cdnNodeLabel(member.node) : member.name)
            : ("site" as const),
      })),
    })),
    packets: lane.kind === "exit" || lane.kind === "pending" ? 1 : 0,
  }));
}

function CdnTreeMesh({
  tree,
  toneFrom,
  busy,
  onSelectLane,
  onSelectSite,
}: {
  tree: CdnForestTree;
  toneFrom: number;
  busy: boolean;
  onSelectLane: (key: string) => void;
  onSelectSite: (id: string) => void;
}) {
  const origin = tree.origin;
  return (
    <EgressMesh
      layout="wrap"
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
      onSelectIp={onSelectLane}
      onSelectSite={onSelectSite}
      empty={
        <p className="egress-flow-empty">
          {busy
            ? t("查询包正在离开本机…")
            : t("开始检测后，边缘节点会在这里亮起来。")}
        </p>
      }
    />
  );
}

export function CdnStage({
  hits,
  busy,
  httpExits,
  action,
}: {
  hits: readonly CdnHit[];
  busy: boolean;
  httpExits?: DnsHttpExit[];
  action?: ReactNode;
}) {
  const [detailLane, setDetailLane] = useState<string | null>(null);
  const [detailLeaf, setDetailLeaf] = useState<string | null>(null);
  const lanes = groupCdnLanes(hits);
  const originExits = collectHttpExits(httpExits);
  const trees = splitCdnForest(lanes, originExits, busy);
  const forest = trees.length > 1;
  const ready = hits.filter((item) => item.node && !item.loading);
  const failed = hits.filter((item) => !item.loading && !item.node);
  const done = hits.filter((item) => !item.loading).length;
  const families = lanes.filter((lane) => lane.kind === "exit");
  const bothTrees =
    forest &&
    trees.every((tree) => tree.lanes.some((lane) => lane.kind === "exit"));
  const selectedLane = detailLane
    ? lanes.find((lane) => lane.key === detailLane)
    : undefined;
  const parsedLeaf = detailLeaf ? parseCdnLeafId(detailLeaf) : undefined;
  const leafLane = parsedLeaf
    ? lanes.find((lane) => lane.key === parsedLeaf.laneKey)
    : undefined;
  const selectedMember = parsedLeaf
    ? leafLane?.members.find((member) => member.id === parsedLeaf.id)
    : undefined;
  const sheet = selectedMember
    ? { kind: "member" as const, member: selectedMember }
    : selectedLane
      ? { kind: "family" as const, lane: selectedLane }
      : null;
  const heldSheet = useRef(sheet);
  if (sheet) heldSheet.current = sheet;
  const view = sheet ?? heldSheet.current;
  const progress = hits.length ? Math.min(1, done / hits.length) : 0;
  const verdict = bothTrees
    ? t("国内和海外边缘都接住了")
    : ready.length
      ? t("边缘节点已点亮")
      : busy
        ? t("正在询问 CDN")
        : t("还没有读到节点");

  return (
    <FlowStage className="egress-flow egress-cdn cyber-cockpit-card hud-frame">
      <div className="egress-flow-toolbar">
        <div className="egress-flow-kicker">
          <span
            className="egress-flow-verdict"
            data-state={bothTrees ? "split" : ready.length ? "single" : "wait"}
          >
            <span className="egress-flow-verdict-dot" />
            {verdict}
          </span>
          <p className="egress-flow-lead">
            {t(
              "每个 HTTP 出口单独一棵子树。国内 CDN 挂在国内出口下，海外 CDN 挂在海外出口下。节点是边缘 POP，不是你的公网 IP。",
            )}
          </p>
        </div>
        {action ? <div className="egress-flow-actions">{action}</div> : null}
      </div>
      <div
        className="egress-dns-meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={hits.length}
        aria-valuenow={done}
        aria-label={t("CDN 探测进度")}
      >
        <span
          className="egress-dns-meter-fill"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
      <ul className="egress-flow-stats">
        <li>
          <NumberTicker value={families.length} />
          <span>{t("家厂商")}</span>
        </li>
        <li>
          <NumberTicker value={ready.length} />
          <span>{t("个节点")}</span>
        </li>
        <li>
          <NumberTicker value={done} />
          <span>
            /{hits.length} {t("次探测")}
          </span>
        </li>
        <li>
          <NumberTicker value={failed.length} />
          <span>{t("次失败")}</span>
        </li>
      </ul>
      {forest ? (
        <div className="egress-cdn-forest">
          {trees.map((tree, index) => (
            <section
              key={tree.key}
              className="egress-cdn-tree"
              data-path={tree.key}
            >
              <CdnTreeMesh
                tree={tree}
                toneFrom={index * 3}
                busy={busy}
                onSelectLane={(key) => {
                  setDetailLeaf(null);
                  setDetailLane(key);
                }}
                onSelectSite={(id) => {
                  setDetailLane(null);
                  setDetailLeaf(id);
                }}
              />
            </section>
          ))}
        </div>
      ) : trees[0] ? (
        <CdnTreeMesh
          tree={trees[0]}
          toneFrom={0}
          busy={busy}
          onSelectLane={(key) => {
            setDetailLeaf(null);
            setDetailLane(key);
          }}
          onSelectSite={(id) => {
            setDetailLane(null);
            setDetailLeaf(id);
          }}
        />
      ) : null}
      <ResponsiveDialog
        className="egress-sheet-dialog"
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailLane(null);
            setDetailLeaf(null);
          }
        }}
        title={
          view?.kind === "member" ? (
            <CdnMemberTitle member={view.member} />
          ) : view?.kind === "family" ? (
            <CdnFamilyTitle lane={view.lane} />
          ) : (
            t("CDN 节点")
          )
        }
        description={
          view?.kind === "member" ? (
            <CdnMemberDescription member={view.member} />
          ) : view?.kind === "family" ? (
            <CdnFamilyDescription lane={view.lane} />
          ) : null
        }
      >
        {view?.kind === "member" ? (
          <CdnMemberSheet key={view.member.id} member={view.member} />
        ) : view?.kind === "family" ? (
          <CdnFamilySheet
            key={view.lane.key}
            lane={view.lane}
            onSelectMember={(id) => {
              const group =
                cdnLaneGroups(view.lane).find((item) =>
                  item.members.some((member) => member.id === id),
                )?.key ?? "colo";
              setDetailLane(null);
              setDetailLeaf(cdnMemberId(view.lane.key, group, id));
            }}
          />
        ) : null}
      </ResponsiveDialog>
    </FlowStage>
  );
}

export function CdnRetryButton({
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
