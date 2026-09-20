import { useId } from "react";
import { Link } from "react-router-dom";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

/**
 * Brand tile: a gradient badge holding the product's signature motif —
 * one source fanning out into two routes, the same split-egress diagram
 * the home page is built around.
 */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = `brand-grad-${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox="0 0 28 28"
      className={cn("site-brand-mark", className)}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
        <linearGradient id={`${gradientId}-sheen`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.18" />
          <stop offset="48%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="28" height="28" rx="8" fill={`url(#${gradientId})`} />
      <rect width="28" height="28" rx="8" fill={`url(#${gradientId}-sheen)`} />
      <g
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        opacity="0.95"
      >
        <path d="M 8.2 14 C 12 14, 12.8 8.7, 17.4 8.7" />
        <path d="M 8.2 14 C 12 14, 12.8 19.3, 17.4 19.3" />
      </g>
      <circle
        cx="6.4"
        cy="14"
        r="2.3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
      />
      <g fill="#fff">
        <circle cx="20.4" cy="8.7" r="1.8" />
        <circle cx="20.4" cy="19.3" r="1.8" />
      </g>
    </svg>
  );
}

export function SiteBrand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      className={cn("site-brand", className)}
      aria-label={t("IP 网络工具")}
    >
      <BrandMark />
      <span className="site-brand-name" aria-hidden="true">
        <b className="site-brand-name-ip">IP</b>
        {t("网络工具")}
      </span>
    </Link>
  );
}
