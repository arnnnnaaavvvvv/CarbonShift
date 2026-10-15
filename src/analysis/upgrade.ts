import semver from 'semver';
import type { DependencyRecord, MaintenanceRisk, PackageMetadata, UpgradeAssessment } from '../core/types.js';

export function evaluateUpgradeRisk(
  dependency: DependencyRecord,
  currentVersion: string,
  targetVersion: string,
  targetMeta: PackageMetadata,
  currentRisk: MaintenanceRisk,
  targetRisk: MaintenanceRisk,
): UpgradeAssessment {
  const cleanCurrent = semver.clean(currentVersion) ?? currentVersion;
  const cleanTarget = semver.clean(targetVersion) ?? targetVersion;

  const diff = semver.diff(cleanCurrent, cleanTarget);
  let updateType: 'patch' | 'minor' | 'major' = 'minor';
  if (diff === 'major' || diff === 'premajor') {
    updateType = 'major';
  } else if (diff === 'patch' || diff === 'prepatch') {
    updateType = 'patch';
  }

  const isPrerelease = Boolean(semver.prerelease(cleanTarget));

  // Check engine compatibility diff
  let breakingEngineChanges = false;
  if (targetMeta.engines?.node) {
    // If target requires modern node
    if (!semver.satisfies('18.20.0', targetMeta.engines.node) && !semver.satisfies('20.18.0', targetMeta.engines.node)) {
      breakingEngineChanges = true;
    }
  }

  let recommendation: 'upgrade' | 'monitor' | 'hold' | 'replace' = 'upgrade';
  const rationales: string[] = [];

  // 1. Target is deprecated
  if (targetMeta.isDeprecated) {
    recommendation = 'hold';
    rationales.push(`Target version ${targetVersion} is deprecated (${targetMeta.deprecationReason ?? 'No reason provided'}).`);
  }

  // 2. Target is unstable prerelease
  if (isPrerelease) {
    recommendation = 'hold';
    rationales.push(`Target version ${targetVersion} is an unstable prerelease.`);
  }

  // 3. Breaking engine changes
  if (breakingEngineChanges) {
    recommendation = 'hold';
    rationales.push(`Target version ${targetVersion} declares breaking engines.node (${targetMeta.engines?.node}) incompatible with Node 18/20.`);
  }

  // 4. Balanced upgrade decisions (not treating every major as bad or every minor as safe)
  if (recommendation !== 'hold') {
    if (targetRisk === 'critical') {
      recommendation = 'replace';
      rationales.push(`Target version carries critical maintenance risk.`);
    } else if (currentRisk === 'critical' || currentRisk === 'high') {
      if (targetRisk === 'low') {
        recommendation = 'upgrade';
        rationales.push(
          updateType === 'major'
            ? `Major version jump recommended to resolve high/critical maintenance risk in current version.`
            : `Recommended upgrade resolves maintenance risks present in ${currentVersion}.`,
        );
      } else {
        recommendation = 'monitor';
        rationales.push(`Target version still carries ${targetRisk} risk; monitor for healthier alternatives.`);
      }
    } else if (updateType === 'major') {
      recommendation = 'monitor';
      rationales.push(`Major version upgrade. Review breaking changes and release changelog before merging.`);
    } else {
      recommendation = 'upgrade';
      rationales.push(`Safe ${updateType} update within well-maintained release track.`);
    }
  }

  if (targetRisk === 'unknown') {
    rationales.push('Note: Telemetry on target version is incomplete; verify build in test environment.');
  }

  return {
    dependency,
    currentVersion,
    targetVersion,
    updateType,
    currentRisk,
    targetRisk,
    breakingEngineChanges,
    recommendation,
    rationale: rationales.join(' '),
  };
}
