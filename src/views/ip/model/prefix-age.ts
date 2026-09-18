export interface PrefixAge {
  registeredAt: string;
  start?: string;
  end?: string;
  handle?: string;
  cidr?: string;
}

/** Newest residential / ISP prefixes may add this many points before the cap. */
export const FRESHNESS_MAX = 8;

export function prefixAgeDays(
  registeredAt: string | undefined,
  now = Date.now(),
): number | null {
  if (!registeredAt) return null;
  const stamp = Date.parse(registeredAt);
  if (!Number.isFinite(stamp)) return null;
  return Math.floor((now - stamp) / 86_400_000);
}

export function freshnessBonus(
  ageDays: number | null,
  eligible: boolean,
): number {
  if (!eligible || ageDays == null || ageDays < 0) return 0;
  if (ageDays <= 90) return FRESHNESS_MAX;
  if (ageDays <= 180) return 6;
  if (ageDays <= 365) return 4;
  if (ageDays <= 730) return 2;
  return 0;
}
