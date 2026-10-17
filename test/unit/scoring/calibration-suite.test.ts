import { describe, it, expect } from 'vitest';
import { scoreDependencyHealth } from '../../../src/scoring/engine.js';
import type { DependencyRecord, PackageMetadata, RepoMetadata } from '../../../src/core/types.js';

function makeDep(name: string, version: string): DependencyRecord {
  return {
    id: `${name}@${version}`,
    name,
    declaredRange: `^${version}`,
    resolvedVersion: version,
    type: 'prod',
    source: 'npm',
    registryUrl: 'https://registry.npmjs.org',
    isDirect: true,
    dependents: [],
  };
}

describe('Scoring Calibration Golden Suite (12 Archetypes)', () => {
  it('Archetype 1: Hyper-active Enterprise OSS (typescript) -> Low Risk (95-100)', () => {
    const meta: PackageMetadata = {
      name: 'typescript',
      version: '5.4.5',
      latestVersion: '5.4.5',
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      releaseCount: 180,
      isDeprecated: false,
      hasProvenance: true,
      engines: { node: '>=14.17' },
      versionsTime: {
        '5.4.0': new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        '5.4.5': new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    const repo: RepoMetadata = {
      owner: 'microsoft',
      repo: 'TypeScript',
      associationStatus: 'verified',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 98000,
      openIssuesCount: 4000,
    };

    const res = scoreDependencyHealth(makeDep('typescript', '5.4.5'), meta, repo);
    expect(res.maintenanceRisk).toBe('low');
    expect(res.score).toBeGreaterThanOrEqual(95);
  });

  it('Archetype 2: Mature Foundation Framework (express) -> Low Risk (80-95)', () => {
    const meta: PackageMetadata = {
      name: 'express',
      version: '4.19.2',
      latestVersion: '4.19.2',
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      releaseCount: 80,
      isDeprecated: false,
      hasProvenance: true,
      engines: { node: '>= 0.10.0' },
      versionsTime: {
        '0.1.0': '2010-01-01T00:00:00.000Z',
        '4.19.2': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    const repo: RepoMetadata = {
      owner: 'expressjs',
      repo: 'express',
      associationStatus: 'verified',
      isArchived: false,
      isFork: false,
      defaultBranch: 'master',
      stars: 64000,
      openIssuesCount: 150,
    };

    const res = scoreDependencyHealth(makeDep('express', '4.19.2'), meta, repo);
    expect(res.maintenanceRisk).toBe('low');
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.score).toBeLessThanOrEqual(100);
  });

  it('Archetype 3: Mature-Stable Single Purpose Utility (wrappy) -> Low Risk (>= 80)', () => {
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
        '1.0.0': '2015-01-01T00:00:00.000Z',
        '1.0.1': '2015-06-01T00:00:00.000Z',
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
      stars: 120,
      openIssuesCount: 2,
    };

    const res = scoreDependencyHealth(makeDep('wrappy', '1.0.2'), meta, repo);
    expect(res.isMatureStable).toBe(true);
    expect(res.maintenanceRisk).toBe('low');
    expect(res.score).toBeGreaterThanOrEqual(80);
  });

  it('Archetype 4: Formally Deprecated Legacy Library (request) -> Critical Risk (<= 20)', () => {
    const meta: PackageMetadata = {
      name: 'request',
      version: '2.88.2',
      latestVersion: '2.88.2',
      publishedAt: '2020-02-11T00:00:00.000Z',
      releaseCount: 150,
      isDeprecated: true,
      deprecationReason: 'request has been deprecated',
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

    const res = scoreDependencyHealth(makeDep('request', '2.88.2'), meta, repo);
    expect(res.maintenanceRisk).toBe('critical');
    expect(res.score).toBeLessThanOrEqual(20);
  });

  it('Archetype 5: Archived Upstream Repository (urllib-v1) -> Critical Risk (<= 25)', () => {
    const meta: PackageMetadata = {
      name: 'urllib',
      version: '1.2.0',
      latestVersion: '1.2.0',
      publishedAt: '2019-01-01T00:00:00.000Z',
      releaseCount: 15,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: { '1.2.0': '2019-01-01T00:00:00.000Z' },
    };
    const repo: RepoMetadata = {
      owner: 'node-modules',
      repo: 'urllib',
      associationStatus: 'verified',
      isArchived: true, // Archived
      isFork: false,
      defaultBranch: 'master',
      stars: 800,
      openIssuesCount: 0,
    };

    const res = scoreDependencyHealth(makeDep('urllib', '1.2.0'), meta, repo);
    expect(res.maintenanceRisk).toBe('critical');
    expect(res.score).toBeLessThanOrEqual(25);
  });

  it('Archetype 6: Spoofed / Impersonating Monorepo Link -> High Risk (<= 30)', () => {
    const meta: PackageMetadata = {
      name: 'react-fake-tools',
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
      associationStatus: 'divergent', // flagged by repo verifier
      unverifiedReason: 'Package claims monorepo facebook/react without verified provenance.',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 220000,
      openIssuesCount: 1000,
    };

    const res = scoreDependencyHealth(makeDep('react-fake-tools', '1.0.0'), meta, repo);
    expect(res.maintenanceRisk).toBe('high');
    expect(res.score).toBeLessThanOrEqual(30);
  });

  it('Archetype 7: Clean Utility with No Public Git Repo -> Missing data reduces confidence, never penalizes', () => {
    const meta: PackageMetadata = {
      name: 'pure-js-helper',
      version: '1.0.0',
      latestVersion: '1.0.0',
      publishedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      releaseCount: 5,
      isDeprecated: false,
      hasProvenance: false,
      engines: { node: '>=18' },
      versionsTime: {
        '1.0.0': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    };
    const repo: RepoMetadata = {
      owner: '',
      repo: '',
      associationStatus: 'missing',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 0,
      openIssuesCount: 0,
      unverifiedReason: 'No repository declared.',
    };

    const res = scoreDependencyHealth(makeDep('pure-js-helper', '1.0.0'), meta, repo);
    // Confidence is 0.40 (registry) + 0.15 (runtime) = 0.55 >= 0.35 threshold
    expect(res.confidence).toBeGreaterThanOrEqual(0.35);
    expect(res.score).not.toBeNull();
    // Missing repo did NOT deduct points; score should be high/healthy
    expect(res.score).toBeGreaterThanOrEqual(80);
    expect(res.maintenanceRisk).toBe('low');
  });

  it('Archetype 8: Determinism under Shuffled Input Order', () => {
    const deps = [
      makeDep('a-lib', '1.0.0'),
      makeDep('m-lib', '2.0.0'),
      makeDep('z-lib', '3.0.0'),
    ];

    const mockMeta: PackageMetadata = {
      name: 'pkg',
      version: '1.0.0',
      latestVersion: '1.0.0',
      publishedAt: new Date().toISOString(),
      releaseCount: 1,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: {},
    };
    const mockRepo: RepoMetadata = {
      owner: 'org',
      repo: 'pkg',
      associationStatus: 'verified',
      isArchived: false,
      isFork: false,
      defaultBranch: 'main',
      stars: 10,
      openIssuesCount: 0,
    };

    const res1 = deps.map(d => scoreDependencyHealth(d, mockMeta, mockRepo));
    const shuffledDeps = [...deps].reverse();
    const res2 = shuffledDeps.map(d => scoreDependencyHealth(d, mockMeta, mockRepo));

    for (const d of deps) {
      const match1 = res1.find(r => r.dependency.id === d.id);
      const match2 = res2.find(r => r.dependency.id === d.id);
      expect(match1?.score).toBe(match2?.score);
      expect(match1?.maintenanceRisk).toBe(match2?.maintenanceRisk);
    }
  });
});
