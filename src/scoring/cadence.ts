import type { HealthEvidence, PackageMetadata } from '../core/types.js';

export interface CadenceAnalysis {
  readonly daysSinceLastRelease: number;
  readonly releasesPast24Months: number;
  readonly evidence: readonly HealthEvidence[];
}

export function analyzeReleaseCadence(
  meta: PackageMetadata,
  isMatureStable: boolean,
): CadenceAnalysis {
  const now = Date.now();
  const lastPublished = meta.publishedAt ? new Date(meta.publishedAt).getTime() : NaN;
  const isDateValid = !Number.isNaN(lastPublished);
  const daysSinceLastRelease = isDateValid
    ? Math.max(0, Math.floor((now - lastPublished) / (24 * 60 * 60 * 1000)))
    : 0;

  // Count releases in last 24 months (730 days)
  const twoYearsAgoMs = now - 730 * 24 * 60 * 60 * 1000;
  let releasesPast24Months = 0;

  if (meta.versionsTime) {
    for (const dateStr of Object.values(meta.versionsTime)) {
      const d = new Date(dateStr).getTime();
      if (!Number.isNaN(d) && d >= twoYearsAgoMs) {
        releasesPast24Months++;
      }
    }
  }

  const evidence: HealthEvidence[] = [];

  if (!isDateValid) {
    evidence.push({
      signal: 'release_recency',
      observedValue: { daysSinceLastRelease: null },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: 'Release publication timestamp is not available in registry metadata.',
      contribution: 0,
    });
  } else if (isMatureStable) {
    if (daysSinceLastRelease > 1095) {
      // 3+ years
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease, isMatureStable: true },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Last release was ${daysSinceLastRelease} days ago. As a mature-stable package, core functionality remains established, but runtime verification is advised.`,
        contribution: -5,
      });
    } else {
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease, isMatureStable: true },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Last release was ${daysSinceLastRelease} days ago. Consistent with mature-stable package maintenance.`,
        contribution: 5,
      });
    }
  } else {
    // Active / Emerging lifecycle
    if (daysSinceLastRelease <= 180) {
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Active release cadence: last published ${daysSinceLastRelease} days ago.`,
        contribution: 10,
      });
    } else if (daysSinceLastRelease <= 365) {
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Moderate release cadence: last published ${daysSinceLastRelease} days ago.`,
        contribution: 0,
      });
    } else if (daysSinceLastRelease <= 730) {
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Slow maintenance: no releases in ${daysSinceLastRelease} days (>1 year) for an active lifecycle package.`,
        contribution: -15,
      });
    } else {
      evidence.push({
        signal: 'release_recency',
        observedValue: { daysSinceLastRelease },
        source: 'npm',
        observedAt: new Date().toISOString(),
        explanation: `Stagnant release cadence: no published releases in ${daysSinceLastRelease} days (>2 years).`,
        contribution: -25,
      });
    }
  }

  // Cadence frequency evidence
  if (releasesPast24Months >= 4) {
    evidence.push({
      signal: 'release_cadence',
      observedValue: { releasesPast24Months },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: `Consistent release cadence: ${releasesPast24Months} releases published in the last 24 months.`,
      contribution: 5,
    });
  }

  return {
    daysSinceLastRelease,
    releasesPast24Months,
    evidence,
  };
}
