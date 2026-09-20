import { t } from "@/i18n";
import {
  anonymousHit,
  anonymousNegative,
  typedAnonymousHit,
} from "@/views/ip/model/anonymity";
import { prefixAgeDays, type PrefixAge } from "@/views/ip/model/prefix-age";
import {
  REQUIRED_ANONYMITY_SOURCES,
  reputationApplies,
  qualityProfile,
} from "@/views/ip/model/quality-policy";
import { parseAbuseRaw } from "@/views/ip/model/scores";
import { usableScore } from "@/views/ip/model/verdict";
import type { QualityBand, SourceEvidence, UsageClass } from "./quality";
import type { CoffeeIp } from "../coffee";

/**
 * Site-specific reference index, not a calibrated risk probability.
 * Vendor bands and these weights are heuristics; upstream sources may overlap.
 * Available dimensions keep their relative weights. Unknowns have no numeric prior.
 * S = round(min(sum(available w * dimension) / sum(available w), C)).
 * Some reputation or anonymity evidence is required; usage alone is not quality.
 * Registration age is context only and never changes the score.
 */
export const QUALITY_WEIGHTS = {
  reputation: 0.45,
  anonymity: 0.35,
  usage: 0.2,
} as const;

export const REPUTATION_SOURCE_WEIGHTS = {
  coffee: 0.3,
  scamalytics: 0.25,
  ippure: 0.2,
  proxycheck: 0.15,
  ip2location: 0.1,
} as const;

export interface EvidenceCoverage {
  reputation: string[];
  anonymity: string[];
  usage: string[];
}

export interface QualityScore {
  value: number | null;
  band: QualityBand;
  bandLabel: string;
  reference: boolean;
  reputation: number | null;
  anonymity: number | null;
  usage: number | null;
  uncapped: number | null;
  freshnessDays: number | null;
  prefixRegisteredAt?: string;
  cap: number;
  sourcesUsed: number;
  evidence: EvidenceCoverage;
  status: "ready" | "provisional" | "unavailable";
  effectiveWeights: Record<keyof typeof QUALITY_WEIGHTS, number>;
  missingSources: string[];
  profile: ReturnType<typeof qualityProfile>;
}

export function clampScore(value: number) {
  return Math.min(100, Math.max(0, value));
}

export function bandFromScore(score: number | null): QualityBand {
  if (score == null) return "neutral";
  if (score >= 80) return "good";
  if (score >= 60) return "warn";
  if (score >= 40) return "poor";
  return "bad";
}

export function qualityBandLabel(band: QualityBand) {
  if (band === "good") return t("比较好");
  if (band === "warn") return t("需核实");
  if (band === "poor") return t("较差");
  if (band === "bad") return t("明显有问题");
  return t("数据不足");
}

/** Scamalytics: 0–19 allow, 20–59 challenge, 60–89 step-up, 90+ block. */
export function mapScamalyticsFraud(score: number) {
  if (score <= 19) return 92;
  if (score <= 59) return 62;
  if (score <= 89) return 32;
  return 12;
}

/** proxycheck.io: 0–25 low, 26–65 challenge, 66+ dangerous. */
export function mapProxycheckRisk(score: number) {
  if (score <= 25) return 92;
  if (score <= 65) return 55;
  return 18;
}

/** IP2Location has no published fraud bands; use the worker's 30 / 70 cuts. */
export function mapIp2LocationFraud(score: number) {
  if (score <= 30) return 92;
  if (score < 70) return 62;
  return 18;
}

export function mapPurity(score: number) {
  return clampScore(score);
}

export function coffeeReputation(coffee: CoffeeIp): number | null {
  const trust = usableScore(coffee.trust_score);
  const level = coffee.intelligence?.abuser_level?.trim().toLowerCase();
  const parsed = parseAbuseRaw(
    coffee.intelligence?.abuser_score_raw ?? coffee.abuser_score,
  );
  const hundred =
    parsed.score != null && parsed.score >= 1 ? parsed.score : null;
  const high =
    coffee.is_abuser === true ||
    level === "high" ||
    (hundred != null && hundred >= 70);
  const medium = level === "medium" || (hundred != null && hundred >= 40);
  if (trust == null && !high && !medium) return null;
  let value = trust ?? (high ? 20 : 45);
  if (high) value = Math.min(value, 20);
  else if (medium) value = Math.min(value, 45);
  return clampScore(value);
}

function sourceReputation(
  source: SourceEvidence,
  coffee: CoffeeIp,
): number | null {
  if (source.id === "coffee") return coffeeReputation(coffee);
  const raw = source.reputation?.raw;
  if (raw == null || !Number.isFinite(raw)) return null;
  if (source.reputation?.kind === "purity") return mapPurity(raw);
  if (source.reputation?.kind === "risk") return mapProxycheckRisk(raw);
  if (source.reputation?.kind === "fraud") {
    if (source.id === "scamalytics") return mapScamalyticsFraud(raw);
    if (source.id === "ip2location") return mapIp2LocationFraud(raw);
    return mapScamalyticsFraud(raw);
  }
  return null;
}

function weightedMean(
  parts: { weight: number; value: number }[],
  fallback: number | null = null,
) {
  let weight = 0;
  let sum = 0;
  for (const part of parts) {
    if (part.weight <= 0) continue;
    weight += part.weight;
    sum += part.weight * part.value;
  }
  return weight > 0 ? sum / weight : fallback;
}

function usageScore(votes: UsageClass[], publicService: boolean) {
  if (publicService) return 70;
  const count = (kind: UsageClass) =>
    votes.filter((value) => value === kind).length;
  const residential = count("residential");
  const mobile = count("mobile");
  const isp = count("isp");
  const org = count("org");
  const datacenter = count("datacenter");
  const homeLike = residential + mobile + isp + org;
  if (datacenter > 0 && (residential > 0 || mobile > 0 || isp > 0)) return 50;
  if (residential > 0 && org > 0 && datacenter === 0) return 72;
  if (datacenter > homeLike) return 48;
  if (org > 0 && datacenter === 0 && residential === 0) return 75;
  if (isp > 0 && datacenter === 0 && residential === 0 && mobile === 0)
    return 78;
  if (mobile > 0 && mobile >= residential && datacenter === 0) return 90;
  if (residential > 0 && datacenter === 0) return 90;
  if (votes.length === 0) return null;
  return 68;
}

function anonymityScore(sources: SourceEvidence[]) {
  const typedYes = sources.filter(typedAnonymousHit).length;
  const typedNo = sources.filter(anonymousNegative).length;
  const untyped = sources.some((source) => source.untypedAnonymous);
  if (sources.some((source) => source.residentialProxy || source.tor))
    return 15;
  if (typedYes >= 2 && typedYes > typedNo) return 25;
  if (typedYes >= 1 && typedNo === 0) return 45;
  if (typedYes >= 1 && typedNo >= 1) return 50;
  if (untyped && typedNo > 0) return 62;
  if (untyped) return 55;
  if (typedNo > 0) return 92;
  return null;
}

function scoreCap(
  sources: SourceEvidence[],
  coffee: CoffeeIp,
  votes: UsageClass[],
  typedYes: number,
  typedNo: number,
  publicService: boolean,
) {
  let cap = 100;
  const extreme = sources.filter((item) => item.extremeFraud).length;
  const abuser = coffee.is_abuser === true;
  if (abuser || extreme >= 2 || (extreme >= 1 && typedYes >= 2))
    cap = Math.min(cap, 25);
  if (sources.some((item) => item.residentialProxy)) cap = Math.min(cap, 30);
  if (sources.some((item) => item.tor) && typedYes >= 1)
    cap = Math.min(cap, 25);
  if (typedYes >= 2 && typedYes > typedNo) cap = Math.min(cap, 40);
  if (!publicService) {
    const datacenter = votes.filter((value) => value === "datacenter").length;
    const other = votes.length - datacenter;
    if (datacenter > other) cap = Math.min(cap, 60);
  }
  return cap;
}

export function collectUsageVotes(sources: SourceEvidence[]): UsageClass[] {
  // One provider contributes one usage reading. Company ownership is not an
  // additional, independent observation of how an address is connected.
  return sources
    .map((item) => item.usage)
    .filter((value): value is UsageClass => value != null);
}

export function scoreQuality(
  coffee: CoffeeIp,
  sources: SourceEvidence[],
  options: {
    prefix?: PrefixAge | null;
    now?: number;
    publicService?: boolean;
  } = {},
): QualityScore {
  const ready = sources.filter(
    (item) => item.status === "ready" && reputationApplies(item.id, coffee.ip),
  );
  const sourcesUsed = ready.length;
  const freshnessDays = prefixAgeDays(
    options.prefix?.registeredAt,
    options.now,
  );
  const reputationParts: { weight: number; value: number }[] = [];
  const evidence: EvidenceCoverage = {
    reputation: [],
    anonymity: [],
    usage: [],
  };
  for (const [id, weight] of Object.entries(REPUTATION_SOURCE_WEIGHTS) as [
    keyof typeof REPUTATION_SOURCE_WEIGHTS,
    number,
  ][]) {
    const source = ready.find((item) => item.id === id);
    if (!source) continue;
    const value = sourceReputation(source, coffee);
    if (value == null) continue;
    reputationParts.push({ weight, value });
    evidence.reputation.push(id);
  }
  const expectedReputation = Object.keys(REPUTATION_SOURCE_WEIGHTS).filter(
    (id) => reputationApplies(id, coffee.ip),
  );
  const missingReputation = expectedReputation.filter(
    (id) => !evidence.reputation.includes(id),
  );
  const reputation = weightedMean(reputationParts);
  const anonymity = anonymityScore(ready);
  const votes = collectUsageVotes(ready);
  const publicService =
    options.publicService === true || coffee.is_public_service === true;
  const usage = usageScore(votes, publicService);
  const typedYes = ready.filter(typedAnonymousHit).length;
  const typedNo = ready.filter(anonymousNegative).length;
  evidence.anonymity = ready
    .filter((item) => anonymousHit(item) || anonymousNegative(item))
    .map((item) => item.id);
  evidence.usage = ready
    .filter((item) => item.usage != null)
    .map((item) => item.id);
  const cap = scoreCap(ready, coffee, votes, typedYes, typedNo, publicService);
  const missingSources = [
    ...new Set([
      ...sources
        .filter(
          (source) =>
            reputationApplies(source.id, coffee.ip) &&
            (source.status === "unavailable" || source.status === "pending"),
        )
        .map((source) => source.id),
      ...missingReputation,
      ...REQUIRED_ANONYMITY_SOURCES.filter(
        (id) => !evidence.anonymity.includes(id),
      ),
    ]),
  ].sort();
  const dimensions = { reputation, anonymity, usage };
  const includedWeight = (
    Object.keys(dimensions) as (keyof typeof dimensions)[]
  ).reduce(
    (sum, key) => sum + (dimensions[key] == null ? 0 : QUALITY_WEIGHTS[key]),
    0,
  );
  const effectiveWeights = Object.fromEntries(
    (Object.keys(dimensions) as (keyof typeof dimensions)[]).map((key) => [
      key,
      dimensions[key] == null || includedWeight === 0
        ? 0
        : QUALITY_WEIGHTS[key] / includedWeight,
    ]),
  ) as QualityScore["effectiveWeights"];
  const uncapped =
    reputation == null && anonymity == null
      ? null
      : (reputation ?? 0) * effectiveWeights.reputation +
        (anonymity ?? 0) * effectiveWeights.anonymity +
        (usage ?? 0) * effectiveWeights.usage;
  // Provider count describes coverage, not independence or statistical confidence.
  const reference =
    uncapped == null ||
    missingSources.length > 0 ||
    Object.values(dimensions).some((value) => value == null) ||
    Object.values(evidence).some((ids) => ids.length < 2) ||
    sources.some(
      (source) =>
        source.status === "pending" ||
        source.status === "unavailable" ||
        source.reputationConflict,
    );
  const value =
    uncapped == null ? null : Math.round(clampScore(Math.min(uncapped, cap)));
  const band = bandFromScore(value);
  return {
    value,
    band,
    bandLabel: qualityBandLabel(band),
    reference,
    reputation,
    anonymity,
    usage,
    uncapped,
    freshnessDays,
    prefixRegisteredAt: options.prefix?.registeredAt,
    cap,
    sourcesUsed,
    evidence,
    status: value == null ? "unavailable" : reference ? "provisional" : "ready",
    effectiveWeights,
    missingSources,
    profile: qualityProfile(coffee.ip),
  };
}
