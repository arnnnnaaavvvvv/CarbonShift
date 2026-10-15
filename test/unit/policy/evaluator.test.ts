import { describe, it, expect } from 'vitest';
import { evaluatePolicy } from '../../../src/policy/evaluator.js';
import type { DependencyHealthResult, PolicyRule } from '../../../src/core/types.js';

describe('Policy Evaluator', () => {
  const makeHealthResult = (name: string, version: string, risk: 'low' | 'medium' | 'high' | 'critical' | 'unknown', score: number | null): DependencyHealthResult => ({
    dependency: {
      id: `${name}@${version}`,
      name,
      declaredRange: `^${version}`,
      resolvedVersion: version,
      type: 'prod',
      source: 'npm',
      registryUrl: 'https://registry.npmjs.org',
      isDirect: true,
      dependents: [],
    },
    score,
    maintenanceRisk: risk,
    confidence: 0.9,
    isMatureStable: false,
    evidence: [],
    analyzedAt: new Date().toISOString(),
    scoringVersion: '1.0.0',
  });

  it('passes when no dependencies breach failOnRisk', () => {
    const results = [
      makeHealthResult('express', '4.19.2', 'low', 90),
      makeHealthResult('debug', '4.3.4', 'medium', 75),
    ];
    const policy: PolicyRule = {
      failOnRisk: ['critical'],
      maxHighRiskAllowed: 0,
      allowList: [],
      treatUnknownAsFailure: false,
    };

    const evalResult = evaluatePolicy(results, policy);
    expect(evalResult.isPassed).toBe(true);
    expect(evalResult.violations).toHaveLength(0);
  });

  it('fails with violation when a dependency breaches failOnRisk', () => {
    const results = [
      makeHealthResult('request', '2.88.2', 'critical', 15),
    ];
    const policy: PolicyRule = {
      failOnRisk: ['critical'],
      maxHighRiskAllowed: 0,
      allowList: [],
      treatUnknownAsFailure: false,
    };

    const evalResult = evaluatePolicy(results, policy);
    expect(evalResult.isPassed).toBe(false);
    expect(evalResult.violations).toHaveLength(1);
    expect(evalResult.violations[0]?.risk).toBe('critical');
  });

  it('permits violations if package is in allowList with documented reason', () => {
    const results = [
      makeHealthResult('legacy-pkg', '1.0.0', 'critical', 10),
    ];
    const policy: PolicyRule = {
      failOnRisk: ['critical'],
      maxHighRiskAllowed: 0,
      allowList: [
        {
          name: 'legacy-pkg',
          versionRange: '^1.0.0',
          reason: 'Legacy migration planned for next sprint',
        },
      ],
      treatUnknownAsFailure: false,
    };

    const evalResult = evaluatePolicy(results, policy);
    expect(evalResult.isPassed).toBe(true);
    expect(evalResult.allowedExceptions).toHaveLength(1);
  });

  it('rejects exception if allowList entry has expired', () => {
    const results = [
      makeHealthResult('legacy-pkg', '1.0.0', 'critical', 10),
    ];
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // yesterday
    const policy: PolicyRule = {
      failOnRisk: ['critical'],
      maxHighRiskAllowed: 0,
      allowList: [
        {
          name: 'legacy-pkg',
          reason: 'Expired exception',
          expiresAt: pastDate,
        },
      ],
      treatUnknownAsFailure: false,
    };

    const evalResult = evaluatePolicy(results, policy);
    expect(evalResult.isPassed).toBe(false);
    expect(evalResult.violations).toHaveLength(1);
  });
});
