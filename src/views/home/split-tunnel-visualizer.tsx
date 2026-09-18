import { useId } from "react";
import { Link } from "react-router-dom";
import { CountryFlag } from "@/components/country-flag";
import { IpText, Pending } from "@/components/toolkit";
import { TrustGauge } from "@/components/trust-gauge";
import { Badge } from "@/components/ui/badge";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Laptop, Shield, Globe2, Compass } from "lucide-react";

export interface EgressCardData {
  index: number;
  label: string;
  data?: { ip: string };
  geo?: {
    ip?: string;
    country_code?: string;
    country?: string;
    region?: string;
    city?: string;
    isp?: string;
    asn?: number | string;
  };
  version: number;
  hasScore: boolean;
  score?: number;
  typeLabels: Array<{ label: string; color: string }>;
  loading: boolean;
  pending: boolean;
  onRetry?: () => void;
}

export interface SplitTunnelVisualizerProps {
  isSplit: boolean;
  cardsData?: EgressCardData[];
  domesticIp?: string;
  domesticGeo?: {
    country?: string;
    region?: string;
    city?: string;
    country_code?: string;
    isp?: string;
  };
  domesticPending?: boolean;
  overseasIp?: string;
  overseasGeo?: {
    country?: string;
    region?: string;
    city?: string;
    country_code?: string;
    isp?: string;
  };
  overseasPending?: boolean;
}

function EgressCockpitPanel({
  card,
  isDomestic,
  isSplit,
}: {
  card: EgressCardData;
  isDomestic: boolean;
  isSplit: boolean;
}) {
  const {
    label,
    data,
    geo,
    version,
    hasScore,
    score,
    typeLabels,
    loading,
    pending,
    onRetry,
  } = card;

  const locationText = [geo?.country, geo?.region, geo?.city]
    .filter(Boolean)
    .filter((item, i, all) => all.indexOf(item) === i)
    .join(" · ");

  const networkText = [geo?.isp, geo?.asn ? `AS${geo.asn}` : undefined]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={`relative p-4 sm:p-5 flex flex-col justify-between transition-colors duration-200 group/panel ${
        isDomestic
          ? "hover:bg-emerald-500/[0.02] dark:hover:bg-emerald-500/[0.03]"
          : "hover:bg-sky-500/[0.02] dark:hover:bg-cyan-500/[0.03]"
      }`}
    >
      {/* Full panel click target to inspect IP */}
      {data && (
        <Link
          to={`/network/ip/${encodeURIComponent(data.ip)}`}
          aria-label={`${label} · ${t("IP 信息查询")}`}
          className="absolute inset-0 z-10 rounded-xl transition-colors hover:bg-primary/[0.02] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        />
      )}

      {/* Top Header / Eyebrow & Badges */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-xs text-foreground/90 flex items-center gap-1.5">
              <span
                className={`size-2 rounded-full ${
                  isDomestic
                    ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                    : "bg-sky-500 dark:bg-cyan-400 shadow-sm shadow-cyan-500/50"
                }`}
              />
              {label}
            </span>
            {typeLabels.map((type) => (
              <Badge
                key={type.label}
                variant="secondary"
                className={`h-4.5 px-2 text-[10px] font-semibold tracking-normal border border-border/60 ${type.color}`}
              >
                {type.label}
              </Badge>
            ))}
          </div>
        </div>

        {/* IP Address & Trust Score Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {pending ? (
              <Pending>{t("加载中...")}</Pending>
            ) : geo ? (
              <>
                <CountryFlag code={geo.country_code} />
                <span className="cyber-neon-ip font-mono text-xl sm:text-2xl font-black tracking-tight text-foreground select-all">
                  <IpText ip={geo.ip || data?.ip || ""} link={false} />
                </span>
              </>
            ) : (
              <span className="muted font-mono text-sm">
                {t("未获取到 IPv")}
                {version}
              </span>
            )}
          </div>
          {hasScore && typeof score === "number" && (
            <TrustGauge
              score={score}
              hint={t(
                "0–100，越高越好。已读取来源按同一套公式计分，不是原始分平均。",
              )}
            />
          )}
        </div>

        {/* Location & ISP Meta */}
        <div className="text-xs text-muted-foreground mt-3 pt-2.5 border-t border-border/40">
          {loading ? (
            <Pending>{t("正在查询归属信息…")}</Pending>
          ) : locationText || networkText ? (
            <>
              {locationText ? (
                <p className="font-medium text-foreground/90">{locationText}</p>
              ) : null}
              {networkText ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {networkText}
                </p>
              ) : null}
            </>
          ) : data ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>{t("归属信息暂不可用")}</span>
              {onRetry && (
                <button
                  type="button"
                  className="relative z-20 shrink-0 text-primary hover:underline cursor-pointer"
                  onClick={onRetry}
                >
                  {t("重试")}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer Connection Status Bar */}
      <div className="mt-3 pt-2.5 border-t border-border/30 flex items-center justify-between text-[11px] font-mono">
        {isSplit ? (
          isDomestic ? (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-emerald-500" />
                </span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold tracking-wider text-[11px]">
                  DIRECT
                </span>
              </div>
              <div className="flex items-center gap-1.5" title={t("直连")}>
                <span className="size-1 rounded-full bg-emerald-500/30" />
                <span className="size-1 rounded-full bg-emerald-500/50" />
                <span className="size-1 rounded-full bg-emerald-500/80 animate-pulse" />
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 dark:bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-2 bg-sky-500 dark:bg-cyan-400" />
                </span>
                <span className="text-sky-600 dark:text-cyan-400 font-semibold tracking-wider text-[11px]">
                  PROXY TUNNEL
                </span>
              </div>
              <div className="flex items-center gap-1.5" title={t("中转")}>
                <span className="size-1 rounded-full bg-sky-500/30 dark:bg-cyan-400/30" />
                <span className="size-1 rounded-full bg-sky-500/50 dark:bg-cyan-400/50" />
                <span className="size-1 rounded-full bg-sky-500/80 dark:bg-cyan-400/80 animate-pulse" />
                <span className="size-1.5 rounded-full bg-sky-500 dark:bg-cyan-400 animate-pulse" />
              </div>
            </>
          )
        ) : (
          <div className="flex items-center gap-2 text-primary font-semibold">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-primary" />
            </span>
            <span className="tracking-wider text-[11px]">DIRECT</span>
          </div>
        )}
      </div>
    </div>
  );
}

function capsulePlace(value?: string) {
  const text = value
    ?.replace(/\s*\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > 28 ? `${text.slice(0, 27)}…` : text;
}

function FlowCapsule({
  x,
  y,
  title,
  kicker,
  ip,
  place,
  width = 156,
  accentClass,
  strokeClass,
  ipClass,
}: {
  x: number;
  y: number;
  title: string;
  kicker: string;
  ip: string;
  place?: string;
  width?: number;
  accentClass: string;
  strokeClass: string;
  ipClass: string;
}) {
  const clipId = useId().replace(/:/g, "");
  const location = capsulePlace(place);
  const height = location ? 50 : 40;
  return (
    <g transform={`translate(${x}, ${y})`}>
      <clipPath id={clipId}>
        <rect x="8" y="1" width={width - 12} height={height - 2} rx="4" />
      </clipPath>
      <text
        x="2"
        y="-6"
        className="text-[10px] fill-foreground/90 font-mono font-bold"
      >
        {title}
      </text>
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="7"
        className={cn("fill-card/90 backdrop-blur-md", strokeClass)}
        strokeWidth="1.2"
      />
      <rect
        x="0"
        y="0"
        width="3.5"
        height={height}
        rx="1.5"
        className={accentClass}
      />
      <g clipPath={`url(#${clipId})`}>
        <text
          x="10"
          y="14"
          className="text-[8.5px] fill-muted-foreground font-mono font-medium"
        >
          {kicker}
        </text>
        <text
          x="10"
          y="30"
          className={cn(
            "text-[12px] font-mono font-bold tracking-tight select-all",
            ipClass,
          )}
        >
          {ip}
        </text>
        {location ? (
          <text
            x="10"
            y="44"
            className="text-[8px] fill-muted-foreground/75 font-mono"
          >
            {location}
          </text>
        ) : null}
      </g>
    </g>
  );
}

export function SplitTunnelVisualizer({
  isSplit,
  cardsData,
  domesticIp,
  domesticGeo,
  domesticPending,
  overseasIp,
  overseasGeo,
  overseasPending,
}: SplitTunnelVisualizerProps) {
  const activeDomesticIp = cardsData?.[0]?.data?.ip || domesticIp;
  const activeOverseasIp = cardsData?.[1]?.data?.ip || overseasIp;

  const domesticLocation = [
    cardsData?.[0]?.geo?.city || domesticGeo?.city,
    cardsData?.[0]?.geo?.region ||
      domesticGeo?.region ||
      cardsData?.[0]?.geo?.country ||
      domesticGeo?.country,
  ]
    .filter(Boolean)
    .filter((item, i, all) => all.indexOf(item) === i)
    .join(" · ");

  const overseasLocation = [
    cardsData?.[1]?.geo?.city || overseasGeo?.city,
    cardsData?.[1]?.geo?.country || overseasGeo?.country,
  ]
    .filter(Boolean)
    .filter((item, i, all) => all.indexOf(item) === i)
    .join(" · ");

  return (
    <div className="split-tunnel-stage w-full my-3 rounded-2xl bg-card/85 border border-primary/25 shadow-lg shadow-primary/[0.05] backdrop-blur-xl overflow-hidden relative group">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_50%_40%,rgba(0,240,255,0.06),transparent_75%)]" />

      {/* 1. Animated SVG Diagram (Spacious 860x170 canvas) */}
      <div className="p-3 sm:p-4 pb-1">
        <div className="relative w-full aspect-[860/170] min-h-[155px] sm:min-h-[180px] max-h-[240px]">
          <svg
            viewBox="0 0 860 170"
            className="w-full h-full select-none overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              {/* Gradients */}
              <linearGradient
                id="vis-grad-green"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient
                id="vis-grad-approach"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient
                id="vis-grad-cyan"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4" />
              </linearGradient>
              <linearGradient
                id="vis-wall-beam"
                x1="0%"
                y1="0%"
                x2="0%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0" />
                <stop offset="20%" stopColor="#00f0ff" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#a855f7" stopOpacity="0.95" />
                <stop offset="80%" stopColor="#00f0ff" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
              </linearGradient>
              <linearGradient
                id="vis-wall-surface"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="0%"
              >
                <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.02" />
                <stop offset="50%" stopColor="#a855f7" stopOpacity="0.09" />
                <stop offset="100%" stopColor="#00f0ff" stopOpacity="0.02" />
              </linearGradient>

              {/* Glowing filters */}
              <filter
                id="laser-glow"
                x="-30%"
                y="-30%"
                width="160%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
              <filter
                id="wall-glow"
                x="-50%"
                y="-20%"
                width="200%"
                height="140%"
              >
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* === 1. Local Device Node (Left) === */}
            <g transform="translate(55, 85)">
              <circle
                r="26"
                className="stroke-emerald-500/20 fill-emerald-500/5"
                strokeWidth="1"
              />
              <circle
                r="20"
                className="stroke-emerald-500/45 fill-card"
                strokeWidth="1.5"
              />
              <circle r="10" className="fill-emerald-500/10 animate-ping" />
              <foreignObject x="-10" y="-10" width="20" height="20">
                <Laptop className="size-5 text-emerald-500" />
              </foreignObject>
              <text
                y="38"
                textAnchor="middle"
                className="text-[10px] fill-foreground font-mono font-bold tracking-tight"
              >
                {t("本地设备")}
              </text>
            </g>

            {/* === 2. Domestic Direct Path (Arcs Upwards to Left/Domestic Target) === */}
            <path
              d="M 81 80 C 135 80, 165 40, 220 40"
              stroke="var(--border)"
              strokeWidth="1.5"
              strokeDasharray="3 3"
            />
            <path
              d="M 81 80 C 135 80, 165 40, 220 40"
              stroke="url(#vis-grad-green)"
              strokeWidth="2.5"
              strokeLinecap="round"
              className="tunnel-flow-direct"
              filter="url(#laser-glow)"
            />
            {/* Animated photons flowing along domestic line */}
            <circle r="3.5" fill="#10b981" filter="url(#laser-glow)">
              <animateMotion
                path="M 81 80 C 135 80, 165 40, 220 40"
                dur="1.8s"
                repeatCount="indefinite"
              />
            </circle>
            <circle r="2.5" fill="#34d399" filter="url(#laser-glow)">
              <animateMotion
                path="M 81 80 C 135 80, 165 40, 220 40"
                dur="1.8s"
                begin="0.9s"
                repeatCount="indefinite"
              />
            </circle>

            {/* Domestic Destination Node (Top Left, before the wall) */}
            <g transform="translate(225, 40)">
              <circle
                r="16"
                className="stroke-emerald-500/40 fill-card"
                strokeWidth="1.5"
              />
              <circle
                r="12"
                className="stroke-emerald-500/20 fill-emerald-500/10"
                strokeWidth="1"
              />
              <circle r="4" className="fill-emerald-500 animate-ping" />
              <circle r="3" className="fill-emerald-500" />
            </g>

            <FlowCapsule
              x={250}
              y={18}
              title={t("国内网站（直连）")}
              kicker={t("国内直连出口")}
              ip={
                domesticPending
                  ? t("加载中...")
                  : activeDomesticIp || "---.---.---.---"
              }
              place={domesticLocation}
              accentClass="fill-emerald-500"
              strokeClass="stroke-emerald-500/35"
              ipClass="fill-emerald-600 dark:fill-emerald-400"
            />

            {/* === 3. Center: The Invisible Wall & Proxy Environment === */}
            {isSplit ? (
              <>
                {/* Path approaching the wall portal */}
                <path
                  d="M 81 90 C 170 90, 290 125, 415 125"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 81 90 C 170 90, 290 125, 415 125"
                  stroke="url(#vis-grad-approach)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="tunnel-flow-approach"
                  filter="url(#laser-glow)"
                />
                {/* Photons entering the wall */}
                <circle r="3.5" fill="#10b981" filter="url(#laser-glow)">
                  <animateMotion
                    path="M 81 90 C 170 90, 290 125, 415 125"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="2.5" fill="#10b981" filter="url(#laser-glow)">
                  <animateMotion
                    path="M 81 90 C 170 90, 290 125, 415 125"
                    dur="1.5s"
                    begin="0.75s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* The Grand Invisible Wall Barrier (Center) */}
                <g transform="translate(415, 8)">
                  <rect
                    x="0"
                    y="0"
                    width="32"
                    height="154"
                    rx="7"
                    fill="url(#vis-wall-surface)"
                    className="stroke-primary/30"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                  />
                  <line
                    x1="16"
                    y1="0"
                    x2="16"
                    y2="154"
                    stroke="url(#vis-wall-beam)"
                    strokeWidth="3.5"
                    className="wall-laser-beam"
                    filter="url(#wall-glow)"
                  />
                  {/* Wall energy grid slats */}
                  <line
                    x1="4"
                    y1="25"
                    x2="28"
                    y2="25"
                    stroke="var(--primary)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <line
                    x1="4"
                    y1="50"
                    x2="28"
                    y2="50"
                    stroke="var(--primary)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <line
                    x1="4"
                    y1="75"
                    x2="28"
                    y2="75"
                    stroke="var(--primary)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <line
                    x1="4"
                    y1="100"
                    x2="28"
                    y2="100"
                    stroke="var(--primary)"
                    strokeOpacity="0.25"
                    strokeWidth="1"
                  />
                  <text
                    x="16"
                    y="-4"
                    textAnchor="middle"
                    className="text-[7.5px] fill-primary/90 font-mono font-bold tracking-wider"
                  >
                    WALL
                  </text>
                </g>

                {/* Proxy Gateway Node in Wall */}
                <g transform="translate(431, 125)">
                  <circle
                    r="22"
                    className="stroke-primary/35 fill-card"
                    strokeWidth="1.5"
                  />
                  <circle
                    r="17"
                    className="stroke-primary/70 fill-primary/10 stroke-dash-rotate"
                    strokeWidth="1.5"
                    strokeDasharray="4 3"
                  />
                  <circle
                    r="12"
                    className="stroke-purple-500/45 fill-purple-500/10"
                    strokeWidth="1"
                  />
                  <foreignObject x="-9" y="-9" width="18" height="18">
                    <Shield className="size-4.5 text-primary" />
                  </foreignObject>
                  <text
                    y="30"
                    textAnchor="middle"
                    className="text-[8.5px] fill-primary font-mono font-bold tracking-tight"
                  >
                    {t("中转")}
                  </text>
                </g>

                {/* === 4. Post-Wall Path (Overseas Proxy Exit) === */}
                <path
                  d="M 447 125 C 500 125, 540 125, 580 125"
                  stroke="var(--border)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
                <path
                  d="M 447 125 C 500 125, 540 125, 580 125"
                  stroke="url(#vis-grad-cyan)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="tunnel-flow-overseas"
                  filter="url(#laser-glow)"
                />
                {/* Moving cyan photons emerging from the wall */}
                <circle r="3.5" fill="#00f0ff" filter="url(#laser-glow)">
                  <animateMotion
                    path="M 447 125 C 500 125, 540 125, 580 125"
                    dur="1.4s"
                    repeatCount="indefinite"
                  />
                </circle>
                <circle r="2.5" fill="#38bdf8" filter="url(#laser-glow)">
                  <animateMotion
                    path="M 447 125 C 500 125, 540 125, 580 125"
                    dur="1.4s"
                    begin="0.7s"
                    repeatCount="indefinite"
                  />
                </circle>

                {/* Overseas Destination Node (Right, beyond the wall) */}
                <g transform="translate(585, 125)">
                  <circle
                    r="18"
                    className="stroke-sky-500/40 dark:stroke-cyan-400/40 fill-card"
                    strokeWidth="1.5"
                  />
                  <circle
                    r="14"
                    className="stroke-sky-500/20 dark:stroke-cyan-400/20 fill-sky-500/5 stroke-dash-rotate"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <foreignObject x="-9" y="-9" width="18" height="18">
                    <Globe2 className="size-4.5 text-sky-500 dark:text-cyan-400" />
                  </foreignObject>
                </g>

                <FlowCapsule
                  x={615}
                  y={100}
                  width={168}
                  title={t("境外服务（代理）")}
                  kicker={t("境外代理出口")}
                  ip={
                    overseasPending
                      ? t("加载中...")
                      : activeOverseasIp || "---.---.---.---"
                  }
                  place={overseasLocation}
                  accentClass="fill-sky-500 dark:fill-cyan-400"
                  strokeClass="stroke-sky-500/35 dark:stroke-cyan-400/35"
                  ipClass="fill-sky-600 dark:fill-cyan-400"
                />
              </>
            ) : (
              /* Single Direct Path when not split */
              <>
                <path
                  d="M 81 85 C 270 85, 470 85, 580 85"
                  stroke="url(#vis-grad-green)"
                  strokeWidth="2.5"
                  className="tunnel-flow-direct"
                  filter="url(#laser-glow)"
                />
                <circle r="3.5" fill="#10b981" filter="url(#laser-glow)">
                  <animateMotion
                    path="M 81 85 C 270 85, 470 85, 580 85"
                    dur="2.2s"
                    repeatCount="indefinite"
                  />
                </circle>
                <g transform="translate(585, 85)">
                  <circle
                    r="18"
                    className="stroke-emerald-500/40 fill-card"
                    strokeWidth="1.5"
                  />
                  <foreignObject x="-9" y="-9" width="18" height="18">
                    <Compass className="size-4.5 text-emerald-500" />
                  </foreignObject>
                </g>

                <FlowCapsule
                  x={615}
                  y={62}
                  width={168}
                  title={t("全局直连 · 无分流")}
                  kicker={t("全局直连出口")}
                  ip={
                    domesticPending
                      ? t("加载中...")
                      : activeDomesticIp || "---.---.---.---"
                  }
                  place={domesticLocation}
                  accentClass="fill-primary"
                  strokeClass="stroke-primary/35"
                  ipClass="fill-primary"
                />
              </>
            )}
          </svg>
        </div>
      </div>

      {/* 2. Merged Detailed Egress Panels (Integrated from Red Box Section) */}
      {cardsData && cardsData.length > 0 ? (
        <div className="relative border-t border-border/50 bg-card/60 backdrop-blur-md">
          {isSplit && cardsData.length >= 2 ? (
            <>
              {/* Laser wall extension divider line running down between the two columns */}
              <div className="hidden md:block absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-gradient-to-b from-primary/70 via-purple-500/50 to-primary/20 z-20 pointer-events-none">
                <div className="absolute inset-y-0 -left-1 -right-1 bg-primary/20 blur-xs" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-border/50">
                <EgressCockpitPanel
                  card={cardsData[0]}
                  isDomestic={true}
                  isSplit={true}
                />
                <EgressCockpitPanel
                  card={cardsData[1]}
                  isDomestic={false}
                  isSplit={true}
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1">
              <EgressCockpitPanel
                card={cardsData[0]}
                isDomestic={true}
                isSplit={false}
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
