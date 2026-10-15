import type { PackageMetadata } from '../core/types.js';

export interface MaturityEvaluation {
  readonly isMatureStable: boolean;
  readonly ageYears: number;
  readonly releaseCount: number;
  readonly reason: string;
}

/**
 * Evaluates whether a package qualifies as mature and feature-complete ("mature-stable"),
 * which waives naive recency penalties for finished utilities.
 */
export function evaluatePackageMaturity(
  meta: PackageMetadata,
  maturityThresholdYears = 4,
): MaturityEvaluation {
  const versions = Object.keys(meta.versionsTime);
  let firstPublishedDate: Date | null = null;

  for (const dateStr of Object.values(meta.versionsTime)) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      if (!firstPublishedDate || d < firstPublishedDate) {
        firstPublishedDate = d;
      }
    }
  }

  // Fallback to publishedAt if versionsTime is sparse
  if (!firstPublishedDate) {
    firstPublishedDate = new Date(meta.publishedAt);
  }

  const ageMs = Date.now() - firstPublishedDate.getTime();
  const ageYears = Math.max(0, ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const releaseCount = Math.max(meta.releaseCount, versions.length);

  // Criteria for mature-stable:
  // 1. Initial release was at least maturityThresholdYears ago
  // 2. Has had multiple releases establishing stability (>= 6 releases)
  // 3. Not currently deprecated
  const isMatureStable =
    ageYears >= maturityThresholdYears && releaseCount >= 6 && !meta.isDeprecated;

  let reason: string;
  if (isMatureStable) {
    reason = `Package has been active for ${ageYears.toFixed(1)} years with ${releaseCount} lifetime releases. Evaluated under mature-stable lifecycle rules.`;
  } else if (meta.isDeprecated) {
    reason = 'Package is marked as deprecated; ineligible for mature-stable classification.';
  } else {
    reason = `Package is in active/emerging lifecycle (${ageYears.toFixed(1)} years old). Regular release cadence expected.`;
  }

  return {
    isMatureStable,
    ageYears: Number(ageYears.toFixed(2)),
    releaseCount,
    reason,
  };
}
