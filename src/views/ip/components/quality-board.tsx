import { useState } from "react";
import { TrustGauge } from "@/components/trust-gauge";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { t } from "@/i18n";
import { maskedIp } from "@/lib/network";
import { ArrowUpRight, CircleHelp } from "lucide-react";
import { TerminalEgressPanel } from "./terminal-egress-panel";
import type { QualityAssessment } from "../model/quality";
import { QUALITY_WEIGHTS } from "../model/quality-score";
import type { TerminalEgressReading } from "../model/terminal-egress";

function maskTerminal(text: string, ip: string | undefined, hidden: boolean) {
  if (!hidden || !ip) return text;
  return text.split(ip).join(maskedIp(ip, true));
}

function weightPct(weight: number) {
  return t("×{0}%", [Math.round(weight * 100)]);
}

function FormulaBody({ assessment }: { assessment: QualityAssessment }) {
  const { reputation, anonymity, usage, freshness, cap, uncapped } =
    assessment.scoreBreakdown;
  const rows =
    assessment.score == null
      ? []
      : [
          {
            label: `R ${t("信誉")}`,
            weight: weightPct(QUALITY_WEIGHTS.reputation),
            value: String(Math.round(reputation)),
          },
          {
            label: `A ${t("匿名")}`,
            weight: weightPct(QUALITY_WEIGHTS.anonymity),
            value: String(Math.round(anonymity)),
          },
          {
            label: `U ${t("用途")}`,
            weight: weightPct(QUALITY_WEIGHTS.usage),
            value: String(Math.round(usage)),
          },
          {
            label: t("加权"),
            weight: "",
            value: uncapped.toFixed(1),
          },
          {
            label: `N ${t("网段加分")}`,
            weight: "",
            value: freshness > 0 ? `+${freshness}` : "0",
          },
          {
            label: `C ${t("上限")}`,
            weight: "",
            value: String(Math.round(cap)),
          },
          {
            label: `S ${t("质量分")}`,
            weight: "",
            value: String(assessment.score),
            result: true,
          },
        ];

  return (
    <div className="ip-folio-formula">
      <p className="ip-folio-formula-eq">
        S = round(min(0.45R + 0.35A + 0.20U + N, C))
      </p>
      {rows.length ? (
        <dl>
          {rows.map((row) => (
            <div key={row.label} data-result={row.result ? "true" : undefined}>
              <dt>
                {row.label}
                {row.weight ? <span>{row.weight}</span> : null}
              </dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="ip-folio-formula-note">
        {t(
          "已读取来源按各家公开分档换算后再加权，不是原始分平均。IPQS 与 AbuseIPDB 只外链、不投票。",
        )}{" "}
        {t(
          "较新的住宅或 ISP 网段最多 +8。机房、代理、滥用或登记超过两年不加分。这是注册局网段登记日，不是宽带开户日。",
        )}
        {assessment.scoreReference ? ` ${t("来源不足 3 家，这是参考分")}` : ""}
      </p>
    </div>
  );
}

function QualityFormulaHelp({ assessment }: { assessment: QualityAssessment }) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const label = t("质量分计算公式");
  const trigger = (
    <button
      type="button"
      className="ip-help-trigger"
      aria-label={label}
      aria-expanded={open}
      onClick={() => setOpen(true)}
    >
      <CircleHelp aria-hidden="true" size={14} strokeWidth={2} />
    </button>
  );
  const body = <FormulaBody assessment={assessment} />;

  if (mobile)
    return (
      <>
        {trigger}
        <ResponsiveDialog
          open={open}
          onOpenChange={setOpen}
          title={label}
          description=""
        >
          {body}
        </ResponsiveDialog>
      </>
    );

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="ip-folio-formula-tip max-w-[min(22rem,calc(100vw-1.5rem))] flex-col items-stretch px-3.5 py-3"
        >
          {body}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function QualityConclusion({
  assessment,
  hidden,
}: {
  assessment: QualityAssessment;
  hidden: boolean;
}) {
  const meta = [
    assessment.scoreReference
      ? t("来源不足 3 家，这是参考分")
      : t(
          "依据 {0} 个已读取来源，按信誉 / 匿名 / 用途计分，较新住宅网段另有加分",
          [assessment.sourcesReady],
        ),
    t("IPQS / AbuseIPDB 未计入"),
    assessment.pending ? t("正在核对其它来源") : "",
    assessment.runtime ? t("终端出口来自本机粘贴，未自动执行") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className="ip-folio-quality"
      data-tone={assessment.band}
      aria-label={t("质量结论")}
    >
      <p className="ip-folio-kicker">
        <span>{t("质量结论")}</span>
        <QualityFormulaHelp assessment={assessment} />
      </p>
      <div className="ip-folio-quality-hero">
        <TrustGauge
          score={assessment.score}
          size="lg"
          caption={t("质量分")}
          hint={t(
            "0–100，越高越好。已读取来源按同一套公式计分，不是原始分平均。",
          )}
        />
        <div className="ip-folio-quality-copy">
          <strong className="ip-folio-quality-kind">
            {assessment.kindLabel}
          </strong>
          <p className="ip-folio-quality-summary">
            {maskTerminal(assessment.summary, assessment.terminalIp, hidden)}
          </p>
          <p className="ip-folio-quality-meta">{meta}</p>
        </div>
      </div>
    </section>
  );
}

function QualityDimensions({
  assessment,
  hidden,
}: {
  assessment: QualityAssessment;
  hidden: boolean;
}) {
  const dims = [
    assessment.network,
    assessment.reputation,
    ...(assessment.freshness ? [assessment.freshness] : []),
    ...(assessment.runtime ? [assessment.runtime] : []),
  ];
  return (
    <ul
      className="ip-folio-dims"
      data-count={dims.length}
      aria-label={t("评估维度")}
    >
      {dims.map((dim) => (
        <li key={dim.id} className="ip-folio-dim" data-tone={dim.tone}>
          <span className="ip-folio-dim-label">{dim.label}</span>
          <strong>{dim.value}</strong>
          {dim.hint ? (
            <span className="ip-folio-dim-hint">
              {maskTerminal(dim.hint, assessment.terminalIp, hidden)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function SourceEvidenceCard({
  source,
}: {
  source: QualityAssessment["sources"][number];
}) {
  const { headline, rows } = source;
  return (
    <a
      className="ip-folio-evidence-card"
      href={source.href}
      target="_blank"
      rel="noopener noreferrer"
      data-status={source.status}
      data-tone={source.tone}
      data-kind={headline.kind}
      title={t("在 {0} 查看详情", [source.name])}
    >
      <span className="ip-folio-evidence-head">
        <span className="ip-folio-evidence-name">
          <strong>{source.name}</strong>
          <span>{source.metric}</span>
        </span>
        <ArrowUpRight aria-hidden="true" className="ip-folio-evidence-icon" />
      </span>
      <span
        className="ip-folio-evidence-hero"
        data-kind={headline.kind}
        data-tone={headline.tone}
      >
        <strong>
          {headline.value}
          {headline.kind === "score" ? <span>/100</span> : null}
        </strong>
        <em>{headline.caption}</em>
      </span>
      {rows.length ? (
        <dl className="ip-folio-evidence-rows">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd data-tone={row.tone} title={row.value}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      <span className="ip-folio-evidence-why">{source.why}</span>
    </a>
  );
}

function SourceEvidenceList({ assessment }: { assessment: QualityAssessment }) {
  return (
    <section className="ip-folio-evidence" aria-label={t("评分依据")}>
      <p className="ip-folio-kicker">{t("评分依据")}</p>
      <ul className="ip-folio-evidence-list">
        {assessment.sources.map((source) => (
          <li key={source.id}>
            <SourceEvidenceCard source={source} />
          </li>
        ))}
      </ul>
      {assessment.pending ? (
        <p className="ip-folio-checks-kicker">{t("正在读取其它来源…")}</p>
      ) : null}
    </section>
  );
}

export function QualityBoard({
  assessment,
  queriedIp,
  terminal,
  terminalError,
  hidden,
  onTerminalPaste,
  onTerminalClear,
}: {
  assessment: QualityAssessment;
  queriedIp: string;
  terminal: TerminalEgressReading | null;
  terminalError: string | null;
  hidden: boolean;
  onTerminalPaste: (value: string) => boolean;
  onTerminalClear: () => void;
}) {
  return (
    <>
      <QualityConclusion assessment={assessment} hidden={hidden} />
      <QualityDimensions assessment={assessment} hidden={hidden} />
      <TerminalEgressPanel
        queriedIp={queriedIp}
        reading={terminal}
        error={terminalError}
        hidden={hidden}
        onSubmit={onTerminalPaste}
        onClear={onTerminalClear}
      />
      <SourceEvidenceList assessment={assessment} />
    </>
  );
}
