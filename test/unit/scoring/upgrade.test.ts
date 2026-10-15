import { describe, it, expect } from 'vitest';
import { evaluateUpgradeRisk } from '../../../src/analysis/upgrade.js';
import type { DependencyRecord, PackageMetadata } from '../../../src/core/types.js';

describe('Upgrade Risk Evaluator', () => {
  const dummyDep: DependencyRecord = {
    id: 'rimraf@3.0.2',
    name: 'rimraf',
    declaredRange: '^3.0.2',
    resolvedVersion: '3.0.2',
    type: 'prod',
    source: 'npm',
    registryUrl: 'https://registry.npmjs.org',
    isDirect: true,
    dependents: [],
  };

  it('recommends major upgrade when current version has high risk and target version is healthy', () => {
    const targetMeta: PackageMetadata = {
      name: 'rimraf',
      version: '5.0.5',
      latestVersion: '5.0.5',
      publishedAt: new Date().toISOString(),
      releaseCount: 50,
      isDeprecated: false,
      hasProvenance: true,
      versionsTime: {},
    };

    const assessment = evaluateUpgradeRisk(dummyDep, '3.0.2', '5.0.5', targetMeta, 'high', 'low');
    expect(assessment.updateType).toBe('major');
    expect(assessment.recommendation).toBe('upgrade');
    expect(assessment.rationale).toContain('Major version jump recommended');
  });

  it('holds upgrade when target version is an unstable prerelease', () => {
    const targetMeta: PackageMetadata = {
      name: 'rimraf',
      version: '6.0.0-rc.1',
      latestVersion: '6.0.0-rc.1',
      publishedAt: new Date().toISOString(),
      releaseCount: 52,
      isDeprecated: false,
      hasProvenance: true,
      versionsTime: {},
    };

    const assessment = evaluateUpgradeRisk(dummyDep, '3.0.2', '6.0.0-rc.1', targetMeta, 'low', 'low');
    expect(assessment.recommendation).toBe('hold');
    expect(assessment.rationale).toContain('unstable prerelease');
  });

  it('holds upgrade when target version is deprecated', () => {
    const targetMeta: PackageMetadata = {
      name: 'legacy-pkg',
      version: '2.0.0',
      latestVersion: '2.0.0',
      publishedAt: new Date().toISOString(),
      releaseCount: 10,
      isDeprecated: true,
      deprecationReason: 'Do not use v2',
      hasProvenance: false,
      versionsTime: {},
    };

    const assessment = evaluateUpgradeRisk(dummyDep, '1.0.0', '2.0.0', targetMeta, 'low', 'critical');
    expect(assessment.recommendation).toBe('hold');
    expect(assessment.rationale).toContain('deprecated');
  });

  it('holds upgrade when target introduces breaking Node engine requirements', () => {
    const targetMeta: PackageMetadata = {
      name: 'future-pkg',
      version: '2.0.0',
      latestVersion: '2.0.0',
      publishedAt: new Date().toISOString(),
      releaseCount: 10,
      isDeprecated: false,
      hasProvenance: false,
      engines: { node: '>=24.0.0' }, // Incompatible with active LTS 18/20
      versionsTime: {},
    };

    const assessment = evaluateUpgradeRisk(dummyDep, '1.0.0', '2.0.0', targetMeta, 'low', 'low');
    expect(assessment.breakingEngineChanges).toBe(true);
    expect(assessment.recommendation).toBe('hold');
    expect(assessment.rationale).toContain('breaking engines.node');
  });
});
