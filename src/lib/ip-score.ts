export function ipScoreColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score) || score < 0 || score > 100)
    return "var(--muted-foreground)";
  return score >= 80
    ? "var(--success)"
    : score >= 40
      ? "var(--warning)"
      : "var(--danger)";
}
