import { t } from "@/i18n";
import {
  freshnessBonus,
  prefixAgeDays,
  type PrefixAge,
} from "@/views/ip/model/prefix-age";
import { parseAbuseRaw } from "@/views/ip/model/scores";
import { usableScore } from "@/views/ip/model/verdict";
import type { QualityBand, SourceEvidence, UsageClass } from "./quality";
import type { CoffeeIp } from "../coffee";

/**
 * Canonical IP quality score for this project.
 *
 * Output is 0–100, higher is cleaner. Ready sources vote; IPQS and AbuseIPDB
 * never vote. Numeric scales are mapped through each vendor's published bands
 * before mixing. VPN / proxy flags are not subtracted from Coffee trust
 * (that would double-count the anonymity dimension). Coffee abuser_score
 * values below 1 are rates, not 0–100 points.
 *
 * S = round(min(0.45 R + 0.35 A + 0.20 U + N, C))
 * N is 0–8 for a recently registered residential/ISP prefix, else 0.
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

const ANON_SOURCE_IDS = new Set([
  "coffee",
  "ipinfo",
  "ip2location",
  "ipapi",
  "scamalytics",
  "proxycheck",
]);

const REPUTATION_PRIOR = 70;
const MIN_SOURCES_FOR_FINAL = 3;

export interface QualityScore {
  value: number | null;
  band: QualityBand;
  bandLabel: string;
  reference: boolean;
  reputation: number;
  anonymity: number;
  usage: number;
  uncapped: number;
  freshness: number;
  freshnessDays: number | null;
  freshnessEligible: boolean;
  prefixRegisteredAt?: string;
  cap: number;
  sourcesUsed: number;
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
  let value = trust ?? REPUTATION_PRIOR;
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
  fallback: number,
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

function usageScore(votes: UsageClass[], coffee: CoffeeIp) {
  if (coffee.is_public_service) return 70;
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
  if (votes.length === 0) return 68;
  return 68;
}

function anonymityScore(sources: SourceEvidence[]) {
  const typed = sources.filter((item) => ANON_SOURCE_IDS.has(item.id));
  if (typed.length < 2) return 70;

  let typedYes = 0;
  let typedNo = 0;
  let untyped = 0;
  let tor = false;
  let residentialProxy = false;

  for (const source of typed) {
    if (source.residentialProxy) residentialProxy = true;
    if (source.tor) tor = true;
    if (source.id === "ipapi" || source.untypedAnonymous) {
      if (source.untypedAnonymous) untyped += 0.5;
      continue;
    }
    if (source.vpn === true || source.proxy === true || source.tor)
      typedYes += 1;
    else if (source.vpn === false && source.proxy === false) typedNo += 1;
  }

  if (residentialProxy) return 15;
  if (tor && typedYes >= 1) return 15;
  if (typedYes >= 2 && typedYes > typedNo) return 25;
  if (typedYes === 1 && typedNo === 0) return 45;
  if (typedYes >= 1 && typedNo >= 1) return 50;
  if (untyped > 0 && typedYes === 0 && typedNo > 0) return 62;
  if (untyped > 0 && typedYes === 0 && typedNo === 0) return 55;
  if (typedYes === 0 && untyped === 0) return 92;
  return 70;
}

function scoreCap(
  sources: SourceEvidence[],
  coffee: CoffeeIp,
  votes: UsageClass[],
  typedYes: number,
  typedNo: number,
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
  if (!coffee.is_public_service) {
    const datacenter = votes.filter((value) => value === "datacenter").length;
    const other = votes.length - datacenter;
    if (datacenter > other) cap = Math.min(cap, 60);
  }
  return cap;
}

function typedCounts(sources: SourceEvidence[]) {
  let typedYes = 0;
  let typedNo = 0;
  for (const source of sources) {
    if (source.id === "ipapi" || source.untypedAnonymous) continue;
    if (!ANON_SOURCE_IDS.has(source.id)) continue;
    if (source.vpn === true || source.proxy === true || source.tor)
      typedYes += 1;
    else if (source.vpn === false && source.proxy === false) typedNo += 1;
  }
  return { typedYes, typedNo };
}

function freshnessEligible(
  coffee: CoffeeIp,
  sources: SourceEvidence[],
  votes: UsageClass[],
  typedYes: number,
) {
  if (coffee.is_public_service) return false;
  if (coffee.is_abuser === true) return false;
  if (
    sources.some(
      (item) => item.status === "ready" && (item.residentialProxy || item.tor),
    )
  )
    return false;
  if (typedYes >= 1) return false;
  const datacenter = votes.filter((value) => value === "datacenter").length;
  const homeLike = votes.filter(
    (value) =>
      value === "residential" ||
      value === "mobile" ||
      value === "isp" ||
      value === "org",
  ).length;
  if (datacenter > 0 && datacenter >= homeLike) return false;
  if (coffee.is_datacenter === true && homeLike === 0) return false;
  return homeLike > 0;
}

function extraOrgVote(coffee: CoffeeIp): UsageClass | null {
  const fromCompany = classifyOrg(coffee.company_type);
  const fromAsn = classifyOrg(coffee.asn_kind);
  return fromCompany ?? fromAsn;
}

function classifyOrg(value?: string): UsageClass | null {
  const key = value?.replace(/\s+/g, " ").trim().toLowerCase();
  if (!key) return null;
  if (
    /edu|university|college|school|government|\bgov\b|business|corporate|enterprise|education/.test(
      key,
    )
  )
    return "org";
  return null;
}

export function collectUsageVotes(
  sources: SourceEvidence[],
  coffee: CoffeeIp,
): UsageClass[] {
  const votes = sources
    .map((item) => item.usage)
    .filter((value): value is UsageClass => value != null);
  const extra = extraOrgVote(coffee);
  if (extra && !votes.includes(extra)) votes.push(extra);
  return votes;
}

export function scoreQuality(
  coffee: CoffeeIp,
  sources: SourceEvidence[],
  options: { prefix?: PrefixAge | null; now?: number } = {},
): QualityScore {
  const ready = sources.filter((item) => item.status === "ready");
  const sourcesUsed = ready.length;
  const freshnessDays = prefixAgeDays(
    options.prefix?.registeredAt,
    options.now,
  );
  if (!sourcesUsed) {
    return {
      value: null,
      band: "neutral",
      bandLabel: qualityBandLabel("neutral"),
      reference: true,
      reputation: REPUTATION_PRIOR,
      anonymity: 70,
      usage: 68,
      uncapped: REPUTATION_PRIOR,
      freshness: 0,
      freshnessDays,
      freshnessEligible: false,
      prefixRegisteredAt: options.prefix?.registeredAt,
      cap: 100,
      sourcesUsed: 0,
    };
  }

  const reputationParts: { weight: number; value: number }[] = [];
  for (const [id, weight] of Object.entries(REPUTATION_SOURCE_WEIGHTS) as [
    keyof typeof REPUTATION_SOURCE_WEIGHTS,
    number,
  ][]) {
    const source = ready.find((item) => item.id === id);
    if (!source) continue;
    const value = sourceReputation(source, coffee);
    if (value == null) continue;
    reputationParts.push({ weight, value });
  }
  const reputation = weightedMean(reputationParts, REPUTATION_PRIOR);
  const anonymity = anonymityScore(ready);
  const votes = collectUsageVotes(ready, coffee);
  const usage = usageScore(votes, coffee);
  const { typedYes, typedNo } = typedCounts(ready);
  const cap = scoreCap(ready, coffee, votes, typedYes, typedNo);
  const eligible = freshnessEligible(coffee, ready, votes, typedYes);
  const freshness = freshnessBonus(freshnessDays, eligible);
  const uncapped =
    QUALITY_WEIGHTS.reputation * reputation +
    QUALITY_WEIGHTS.anonymity * anonymity +
    QUALITY_WEIGHTS.usage * usage;
  const reference = sourcesUsed < MIN_SOURCES_FOR_FINAL;
  const value = Math.round(clampScore(Math.min(uncapped + freshness, cap)));
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
    freshness,
    freshnessDays,
    freshnessEligible: eligible,
    prefixRegisteredAt: options.prefix?.registeredAt,
    cap,
    sourcesUsed,
  };
}
