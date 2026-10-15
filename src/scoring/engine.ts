import type {
  ContextualAdvisory,
  DependencyHealthResult,
  DependencyRecord,
  HealthEvidence,
  MaintenanceRisk,
  PackageMetadata,
  RepoMetadata,
} from '../core/types.js';
import { evaluatePackageMaturity } from './maturity.js';
import { analyzeReleaseCadence } from './cadence.js';
import { analyzeEngineCompatibility } from './compatibility.js';
import { computeConfidence } from './confidence.js';

export interface ScoringOptions {
  minConfidenceThreshold?: number | undefined;
  maturityThresholdYears?: number | undefined;
}

export function scoreDependencyHealth(
  dependency: DependencyRecord,
  packageMeta: PackageMetadata,
  repoMeta: RepoMetadata,
  contextualAdvisories: readonly ContextualAdvisory[] = [],
  options: ScoringOptions = {},
): DependencyHealthResult {
  const minConfidenceThreshold = options.minConfidenceThreshold ?? 0.35;
  const maturityThresholdYears = options.maturityThresholdYears ?? 4;

  const maturity = evaluatePackageMaturity(packageMeta, maturityThresholdYears);
  const cadence = analyzeReleaseCadence(packageMeta, maturity.isMatureStable);
  const compat = analyzeEngineCompatibility(packageMeta);
  const conf = computeConfidence(packageMeta, repoMeta, minConfidenceThreshold);

  const evidence: HealthEvidence[] = [
    ...cadence.evidence,
    ...compat.evidence,
  ];

  // 1. Deprecation Check (Fatal Cap)
  if (packageMeta.isDeprecated) {
    evidence.push({
      signal: 'deprecation',
      observedValue: { isDeprecated: true, reason: packageMeta.deprecationReason },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: `Package is deprecated: ${packageMeta.deprecationReason ?? 'No deprecation reason provided.'}`,
      contribution: -80,
      isFatalCap: true,
      fatalCapValue: 20,
    });
  }

  // 2. Archived Repository Check (Fatal Cap)
  if (repoMeta.isArchived) {
    evidence.push({
      signal: 'archive_status',
      observedValue: { isArchived: true, owner: repoMeta.owner, repo: repoMeta.repo },
      source: 'github',
      observedAt: new Date().toISOString(),
      explanation: `Upstream GitHub repository ${repoMeta.owner}/${repoMeta.repo} has been archived by maintainers.`,
      contribution: -75,
      isFatalCap: true,
      fatalCapValue: 25,
    });
  }

  // 3. Repo Spoofing / Divergence Check (Fatal Cap)
  if (repoMeta.associationStatus === 'divergent') {
    evidence.push({
      signal: 'repo_provenance',
      observedValue: { associationStatus: 'divergent' },
      source: 'github',
      observedAt: new Date().toISOString(),
      explanation: repoMeta.unverifiedReason ?? 'Claimed repository diverges from package identity.',
      contribution: -20,
      isFatalCap: true,
      fatalCapValue: 30,
    });
  } else if (repoMeta.associationStatus === 'verified' && repoMeta.stars > 100) {
    evidence.push({
      signal: 'repo_provenance',
      observedValue: { associationStatus: 'verified', stars: repoMeta.stars },
      source: 'github',
      observedAt: new Date().toISOString(),
      explanation: `Verified repository with active community engagement (${repoMeta.stars} stars).`,
      contribution: 5,
    });
  }

  // 4. Contextual Advisories (Strictly 0 score contribution)
  if (contextualAdvisories.length > 0) {
    evidence.push({
      signal: 'advisory_context',
      observedValue: { advisoryCount: contextualAdvisories.length },
      source: 'advisory',
      observedAt: new Date().toISOString(),
      explanation: `${contextualAdvisories.length} security advisory/advisories noted for contextual awareness (separate from maintenance score).`,
      contribution: 0,
    });
  }

  // Scoring Calculation
  if (!conf.isConfident) {
    evidence.push({
      signal: 'mature_stability',
      observedValue: { confidence: conf.confidence },
      source: 'lockfile',
      observedAt: new Date().toISOString(),
      explanation: 'Insufficient public telemetry to reliably score maintenance health without speculation.',
      contribution: 0,
    });

    return {
      dependency,
      score: null,
      maintenanceRisk: 'unknown',
      confidence: conf.confidence,
      isMatureStable: maturity.isMatureStable,
      evidence,
      contextualAdvisories,
      analyzedAt: new Date().toISOString(),
      scoringVersion: '1.0.0',
    };
  }

  // Sum additive contributions from 100 baseline
  let rawScore = 100;
  for (const item of evidence) {
    rawScore += item.contribution;
  }

  // Apply Fatal Caps to prevent double-counting or inflating dead packages
  let finalScore = rawScore;
  for (const item of evidence) {
    if (item.isFatalCap && item.fatalCapValue !== undefined) {
      finalScore = Math.min(finalScore, item.fatalCapValue);
    }
  }

  finalScore = Math.min(100, Math.max(0, Math.round(finalScore)));

  let maintenanceRisk: MaintenanceRisk = 'low';
  if (finalScore < 25) {
    maintenanceRisk = 'critical';
  } else if (finalScore < 50) {
    maintenanceRisk = 'high';
  } else if (finalScore < 80) {
    maintenanceRisk = 'medium';
  } else {
    maintenanceRisk = 'low';
  }

  return {
    dependency,
    score: finalScore,
    maintenanceRisk,
    confidence: conf.confidence,
    isMatureStable: maturity.isMatureStable,
    evidence,
    contextualAdvisories,
    analyzedAt: new Date().toISOString(),
    scoringVersion: '1.0.0',
  };
}
