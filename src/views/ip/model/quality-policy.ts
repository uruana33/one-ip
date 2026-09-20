/** Versioned coverage requirements, not statistical confidence thresholds. */
export const QUALITY_POLICY_VERSION = "available-evidence-v3";
export const REQUIRED_ANONYMITY_SOURCES = [
  "coffee",
  "ipinfo",
  "ipapi",
  "proxycheck",
] as const;

export function reputationApplies(source: string, ip: string) {
  // The upstream adapter deliberately does not request IPPure for IPv6.
  return source !== "ippure" || !ip.includes(":");
}

export function qualityProfile(ip: string) {
  return ip.includes(":")
    ? ("ipv6-four-source" as const)
    : ("ipv4-five-source" as const);
}
