import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionButton } from "@/components/toolkit";
import { t } from "@/i18n";
import { endpoint } from "@/lib/network";
import { type ReportSummary } from "@/lib/share-report";

export function ReportPrivacyNote() {
  return (
    <p className="small muted">
      {t(
        "本报告为用户主动生成的摘要快照，不含完整浏览器指纹；到期自动删除。WebRTC 检测在用户浏览器本地完成，本站不静默上报真实 ISP IP。",
      )}
    </p>
  );
}

export function ShareReportButton({
  summary,
  ttlDays = 30,
}: {
  summary: ReportSummary;
  ttlDays?: 7 | 30 | 90;
}) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await endpoint<{ id: string }>("/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: 1,
          client: "web",
          summary,
          ttl_days: ttlDays,
        }),
      });
      navigate(`/r/${created.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("生成分享链接失败，请稍后重试"),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <ActionButton size="sm" busy={busy} onClick={create}>
        {busy ? t("正在生成分享链接…") : t("生成分享链接")}
      </ActionButton>
      {error ? <p className="small muted">{error}</p> : null}
    </div>
  );
}
