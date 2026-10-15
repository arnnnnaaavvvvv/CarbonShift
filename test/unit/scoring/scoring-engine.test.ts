import { describe, it, expect } from 'vitest';
import { scoreDependencyHealth } from '../../../src/scoring/engine.js';
import type { DependencyRecord, PackageMetadata, RepoMetadata } from '../../../src/core/types.js';

describe('Deterministic Scoring Engine v1', () => {
  const dummyDep: DependencyRecord = {
    id: 'test-pkg@1.0.0',
    name: 'test-pkg',
    declaredRange: '^1.0.0',
    resolvedVersion: '1.0.0',
    type: 'prod',
    source: 'npm',
    registryUrl: 'https://registry.npmjs.org',
    isDirect: true,
    dependents: [],
  };

  it('verifies mature-stable package remains low risk without recent releases', () => {
    const meta: PackageMetadata = {
      name: 'wrappy',
      version: '1.0.2',
      latestVersion: '1.0.2',
      publishedAt: '2016-05-18T00:00:00.000Z',
      releaseCount: 10,
      isDeprecated: false,
      hasProvenance: false,
      engines: { node: '>=0.10.0' },
      versionsTime: {
        '0.1.0': '2014-01-01T00:00:00.000Z',
        '1.0.2': '2016-05-18T00:00:00.000Z',
      },
    };
    const repo: RepoMetadata = {
      owner: 'npm',
      repo: 'wrappy',
      associationStatus: 'verified',
      isArchived: false,
      isFork: false,
      defaultBranch: 'master',
      stars: 150,
      openIssuesCount: 2,
    };

    const result = scoreDependencyHealth(dummyDep, meta, repo);
    expect(result.isMatureStable).toBe(true);
    expect(result.maintenanceRisk).toBe('low');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it('enforces fatal cap of 20 (Critical Risk) on deprecated packages', () => {
    const meta: PackageMetadata = {
      name: 'request',
      version: '2.88.2',
      latestVersion: '2.88.2',
      publishedAt: '2020-02-11T00:00:00.000Z',
      releaseCount: 150,
      isDeprecated: true,
      deprecationReason: 'request has been deprecated, see https://github.com/request/request/issues/3142',
      hasProvenance: false,
      versionsTime: { '2.88.2': '2020-02-11T00:00:00.000Z' },
    };
    const repo: RepoMetadata = {
      owner: 'request',
      repo: 'request',
      associationStatus: 'verified',
      isArchived: true,
      isFork: false,
      defaultBranch: 'master',
      stars: 25000,
      openIssuesCount: 100,
    };

    const result = scoreDependencyHealth(dummyDep, meta, repo);
    expect(result.maintenanceRisk).toBe('critical');
    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.evidence.some(e => e.signal === 'deprecation' && e.isFatalCap)).toBe(true);
  });

  it('enforces fatal cap of 25 (Critical Risk) on archived repositories', () => {
    const meta: PackageMetadata = {
      name: 'old-utility',
      version: '3.0.0',
      latestVersion: '3.0.0',
      publishedAt: '2021-01-01T00:00:00.000Z',
      releaseCount: 10,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: { '3.0.0': '2021-01-01T00:00:00.000Z' },
    };
    const repo: RepoMetadata = {
      owner: 'author',
      repo: 'old-utility',
      associationStatus: 'verified',
      isArchived: true,
      isFork: false,
      defaultBranch: 'main',
      stars: 50,
      openIssuesCount: 0,
    };

    const result = scoreDependencyHealth(dummyDep, meta, repo);
    expect(result.maintenanceRisk).toBe('critical');
    expect(result.score).toBeLessThanOrEqual(25);
  });

  it('penalizes divergent / spoofed repository link with cap 30 (High Risk)', () => {
    const meta: PackageMetadata = {
      name: 'malicious-spoof',
      version: '1.0.0',
      latestVersion: '1.0.0',
      publishedAt: new Date().toISOString(),
      releaseCount: 1,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: {},
    };
    const repo: RepoMetadata = {
      owner: 'facebook',
      repo: 'react',
      associationStatus: 'divergent',
      unverifiedReason: 'Package malicious-spoof claims monorepo facebook/react without verified provenance.',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 220000,
      openIssuesCount: 1000,
    };

    const result = scoreDependencyHealth(dummyDep, meta, repo);
    expect(result.maintenanceRisk).toBe('high');
    expect(result.score).toBeLessThanOrEqual(30);
  });

  it('keeps security advisory strictly contextual with 0 score impact', () => {
    const meta: PackageMetadata = {
      name: 'healthy-pkg',
      version: '2.0.0',
      latestVersion: '2.0.0',
      publishedAt: new Date().toISOString(),
      releaseCount: 20,
      isDeprecated: false,
      hasProvenance: true,
      versionsTime: {},
    };
    const repo: RepoMetadata = {
      owner: 'author',
      repo: 'healthy-pkg',
      associationStatus: 'verified',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 500,
      openIssuesCount: 5,
    };

    const withoutAdvisory = scoreDependencyHealth(dummyDep, meta, repo, []);
    const withAdvisory = scoreDependencyHealth(dummyDep, meta, repo, [
      {
        advisoryId: 'GHSA-1234-5678',
        title: 'Prototype Pollution',
        severity: 'high',
        url: 'https://osv.dev',
      },
    ]);

    expect(withoutAdvisory.score).toBe(withAdvisory.score);
    expect(withoutAdvisory.maintenanceRisk).toBe(withAdvisory.maintenanceRisk);
    expect(withAdvisory.evidence.find(e => e.signal === 'advisory_context')?.contribution).toBe(0);
  });

  it('returns unknown score and null when telemetry confidence is too low', () => {
    const meta: PackageMetadata = {
      name: 'private-pkg',
      version: '0.1.0',
      latestVersion: '0.1.0',
      publishedAt: '', // Missing
      releaseCount: 1,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: {},
    };
    const repo: RepoMetadata = {
      owner: '',
      repo: '',
      associationStatus: 'missing',
      isArchived: false,
      isFork: false,
      defaultBranch: '',
      stars: 0,
      openIssuesCount: 0,
    };

    const result = scoreDependencyHealth(dummyDep, meta, repo);
    expect(result.score).toBeNull();
    expect(result.maintenanceRisk).toBe('unknown');
    expect(result.confidence).toBeLessThan(0.35);
  });
});
