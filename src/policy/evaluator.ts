import semver from 'semver';
import type {
  DependencyHealthResult,
  MaintenanceRisk,
  PolicyEvaluationResult,
  PolicyRule,
  PolicyViolation,
} from '../core/types.js';

export function evaluatePolicy(
  results: readonly DependencyHealthResult[],
  policy: PolicyRule,
): PolicyEvaluationResult {
  const violations: PolicyViolation[] = [];
  const allowedExceptions: string[] = [];
  const failOnRiskSet = new Set<MaintenanceRisk>(policy.failOnRisk);

  let highRiskCount = 0;

  for (const item of results) {
    const pkgName = item.dependency.name;
    const resolvedVer = item.dependency.resolvedVersion;
    const risk = item.maintenanceRisk;

    // Check allowList exceptions
    const exception = policy.allowList.find(e => {
      if (e.name !== pkgName) return false;

      // Check version range if specified
      if (e.versionRange && e.versionRange !== '*') {
        const cleanVer = semver.clean(resolvedVer);
        if (cleanVer && !semver.satisfies(cleanVer, e.versionRange)) {
          return false;
        }
      }

      // Check expiration date
      if (e.expiresAt) {
        const expTime = new Date(e.expiresAt).getTime();
        if (Date.now() > expTime) {
          return false; // Exception expired
        }
      }

      return true;
    });

    if (exception) {
      allowedExceptions.push(`${pkgName}@${resolvedVer} (Reason: ${exception.reason})`);
      continue;
    }

    if (risk === 'high') {
      highRiskCount++;
    }

    // Check failOnRisk
    if (failOnRiskSet.has(risk)) {
      violations.push({
        dependencyId: item.dependency.id,
        rule: `failOnRisk contains '${risk}'`,
        message: `Dependency ${item.dependency.id} carries ${risk} maintenance risk (score: ${item.score ?? 'unknown'}).`,
        risk,
      });
      continue;
    }

    // Check minScore
    if (policy.minScore !== undefined && item.score !== null && item.score < policy.minScore) {
      violations.push({
        dependencyId: item.dependency.id,
        rule: `minScore (${policy.minScore})`,
        message: `Dependency ${item.dependency.id} scored ${item.score}, below minimum allowed score of ${policy.minScore}.`,
        risk,
      });
      continue;
    }

    // Check treatUnknownAsFailure
    if (policy.treatUnknownAsFailure && risk === 'unknown') {
      violations.push({
        dependencyId: item.dependency.id,
        rule: 'treatUnknownAsFailure',
        message: `Dependency ${item.dependency.id} has insufficient telemetry and was evaluated as unknown.`,
        risk: 'unknown',
      });
    }
  }

  // Check maxHighRiskAllowed
  if (highRiskCount > policy.maxHighRiskAllowed) {
    violations.push({
      dependencyId: 'project',
      rule: `maxHighRiskAllowed (${policy.maxHighRiskAllowed})`,
      message: `Project contains ${highRiskCount} high risk dependencies, exceeding allowed limit of ${policy.maxHighRiskAllowed}.`,
      risk: 'high',
    });
  }

  return {
    isPassed: violations.length === 0,
    violations,
    allowedExceptions,
  };
}
