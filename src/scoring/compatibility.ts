import semver from 'semver';
import type { HealthEvidence, PackageMetadata } from '../core/types.js';

const ACTIVE_NODE_LTS_VERSIONS = ['18.20.0', '20.18.0', '22.11.0'];

export interface CompatibilityAnalysis {
  readonly satisfiesCurrentLts: boolean;
  readonly supportedLtsCount: number;
  readonly evidence: readonly HealthEvidence[];
}

export function analyzeEngineCompatibility(meta: PackageMetadata): CompatibilityAnalysis {
  const nodeEngine = meta.engines?.node;
  const evidence: HealthEvidence[] = [];

  if (!nodeEngine || nodeEngine === '*') {
    // Missing engine field is neutral - missing data is never penalized
    return {
      satisfiesCurrentLts: true,
      supportedLtsCount: ACTIVE_NODE_LTS_VERSIONS.length,
      evidence: [],
    };
  }

  let supportedLtsCount = 0;
  for (const lts of ACTIVE_NODE_LTS_VERSIONS) {
    if (semver.satisfies(lts, nodeEngine)) {
      supportedLtsCount++;
    }
  }

  const satisfiesCurrentLts = supportedLtsCount > 0;

  if (supportedLtsCount === ACTIVE_NODE_LTS_VERSIONS.length) {
    evidence.push({
      signal: 'node_engine_compat',
      observedValue: { nodeEngine, supportedLtsCount },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: `Declared engines.node '${nodeEngine}' fully satisfies all active Node.js LTS runtimes (18, 20, 22).`,
      contribution: 5,
    });
  } else if (supportedLtsCount > 0) {
    evidence.push({
      signal: 'node_engine_compat',
      observedValue: { nodeEngine, supportedLtsCount },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: `Declared engines.node '${nodeEngine}' satisfies a subset (${supportedLtsCount}/${ACTIVE_NODE_LTS_VERSIONS.length}) of active Node.js LTS runtimes.`,
      contribution: 0,
    });
  } else {
    evidence.push({
      signal: 'node_engine_compat',
      observedValue: { nodeEngine, supportedLtsCount: 0 },
      source: 'npm',
      observedAt: new Date().toISOString(),
      explanation: `Declared engines.node '${nodeEngine}' is incompatible with all current Node.js LTS runtimes.`,
      contribution: -25,
      isFatalCap: true,
      fatalCapValue: 40,
    });
  }

  return {
    satisfiesCurrentLts,
    supportedLtsCount,
    evidence,
  };
}
