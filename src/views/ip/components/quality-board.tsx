import { TrustGauge } from "@/components/trust-gauge";
import { t } from "@/i18n";
import { maskedIp } from "@/lib/network";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { TerminalEgressPanel } from "./terminal-egress-panel";
import { qualityScoreNotice, type QualityAssessment } from "../model/quality";
import type { TerminalEgressReading } from "../model/terminal-egress";

function maskTerminal(text: string, ip: string | undefined, hidden: boolean) {
  if (!hidden || !ip) return text;
  return text.split(ip).join(maskedIp(ip, true));
}

function FormulaBody({ assessment }: { assessment: QualityAssessment }) {
  const { reputation, anonymity, usage, cap, effectiveWeights } =
    assessment.scoreBreakdown;
  const display = (value: number | null) =>
    value == null ? t("未返回") : String(Math.round(value));
  const rows = [
    {
      label: t("信誉"),
      value: reputation,
      weight: effectiveWeights.reputation,
    },
    { label: t("匿名"), value: anonymity, weight: effectiveWeights.anonymity },
    { label: t("用途"), value: usage, weight: effectiveWeights.usage },
  ];
  return (
    <div className="ip-folio-formula">
      <p className="ip-folio-formula-eq">S = round(min(Σ(w × D) / Σw, C))</p>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <dt>
              {row.label}
              <span>
                {row.weight
                  ? t("×{0}%", [Math.round(row.weight * 100)])
                  : t("未计入")}
              </span>
            </dt>
            <dd>{display(row.value)}</dd>
          </div>
        ))}
        <div>
          <dt>{t("风险上限")}</dt>
          <dd>{cap}</dd>
        </div>
        <div data-result="true">
          <dt>{t("质量分")}</dt>
          <dd>{display(assessment.score)}</dd>
        </div>
      </dl>
      <p className="ip-folio-formula-note">
        {t(
          "按已读来源和维度加权，未知项不按无风险处理。缺少部分证据时标为估算。",
        )}
      </p>
      <p className="ip-folio-formula-note">
        {t("登记日期、IPQS 与 AbuseIPDB 不计分。")}
      </p>
    </div>
  );
}

function QualityConclusion({
  assessment,
  hidden,
}: {
  assessment: QualityAssessment;
  hidden: boolean;
}) {
  const applicable = assessment.sources.filter(
    (source) =>
      source.status !== "outbound" && source.status !== "not-applicable",
  ).length;
  const estimate = assessment.scoreStatus === "provisional";
  const details = [
    ...new Set(
      maskTerminal(assessment.summary, assessment.terminalIp, hidden).split(
        " · ",
      ),
    ),
  ];
  return (
    <section
      className="ip-folio-quality"
      data-tone={assessment.band}
      aria-label={t("质量结论")}
    >
      <div className="ip-folio-quality-heading">
        <p className="ip-folio-kicker">{t("质量评估")}</p>
        {estimate ? (
          <span
            className="ip-folio-estimate"
            title={qualityScoreNotice(assessment)}
          >
            {t("估算")}
          </span>
        ) : null}
      </div>
      <div className="ip-folio-quality-hero">
        {assessment.score != null ? (
          <TrustGauge
            score={assessment.score}
            size="lg"
            caption={t("质量分")}
            verdict={assessment.bandLabel}
          />
        ) : (
          <div className="ip-folio-quality-wait">
            {assessment.pending ? t("读取中…") : t("暂无读数")}
          </div>
        )}
        <div className="ip-folio-quality-copy">
          <strong className="ip-folio-quality-kind">
            {assessment.headline}
          </strong>
          <p className="ip-folio-quality-summary">{assessment.shortSummary}</p>
          <ul className="ip-folio-quality-tags" aria-label={t("关键判断")}>
            {assessment.tags.map((tag) => (
              <li key={tag.label} data-tone={tag.tone}>
                {tag.label}
              </li>
            ))}
          </ul>
        </div>
        {assessment.keyEvidence.rows.length ? (
          <div className="ip-folio-quality-proof">
            <p className="ip-folio-proof-title">
              {assessment.keyEvidence.title}
            </p>
            <dl>
              {assessment.keyEvidence.rows.map((row) => (
                <div key={row.source}>
                  <dt>{row.source}</dt>
                  <dd data-tone={row.tone}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
      <details className="ip-folio-quality-details">
        <summary>
          <span>
            {t("已读 {0}/{1} 个来源", [assessment.sourcesReady, applicable])}
            {assessment.pending ? ` · ${t("更新中")}` : ""}
          </span>
          <span className="ip-folio-details-action">
            {t("查看依据")}
            <ChevronDown size={14} aria-hidden="true" />
          </span>
        </summary>
        <div className="ip-folio-quality-expanded">
          <div className="ip-folio-reasons">
            <h3>{t("来源说明")}</h3>
            <ul>
              {details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
            <p>{qualityScoreNotice(assessment)}</p>
            <p>
              {t("有效来源：信誉 {0} · 匿名 {1} · 用途 {2}", [
                assessment.evidence.reputation.length,
                assessment.evidence.anonymity.length,
                assessment.evidence.usage.length,
              ])}
            </p>
          </div>
          <div className="ip-folio-calculation">
            <h3>{t("计算方式")}</h3>
            <FormulaBody assessment={assessment} />
          </div>
          <div className="ip-folio-quality-footnote">
            {assessment.publicService ? (
              <p>
                <a
                  href={assessment.publicService.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("官方用途记录：{0}", [assessment.publicService.label])}
                </a>
                {" · "}
                {assessment.publicService.verifiedAt.slice(0, 10)}
              </p>
            ) : null}
            {assessment.checkedAt ? (
              <p>
                {t("来源读取于 {0}", [
                  new Date(assessment.checkedAt).toLocaleString(),
                ])}
              </p>
            ) : null}
            <p>{t("分数用于比较已读风险信号，不代表平台通过率或账号安全。")}</p>
          </div>
        </div>
      </details>
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
