import { describe, it, expect } from 'vitest';
import { evaluatePackageMaturity } from '../../../src/scoring/maturity.js';
import type { PackageMetadata } from '../../../src/core/types.js';

describe('Package Maturity Evaluator', () => {
  it('classifies 5-year-old package with 15 releases as mature-stable', () => {
    const meta: PackageMetadata = {
      name: 'wrappy',
      version: '1.0.2',
      latestVersion: '1.0.2',
      publishedAt: '2016-05-18T00:00:00.000Z',
      releaseCount: 15,
      isDeprecated: false,
      hasProvenance: false,
      versionsTime: {
        '0.0.1': '2014-01-01T00:00:00.000Z',
        '1.0.0': '2015-01-01T00:00:00.000Z',
        '1.0.2': '2016-05-18T00:00:00.000Z',
      },
    };

    const evaluation = evaluatePackageMaturity(meta);
    expect(evaluation.isMatureStable).toBe(true);
    expect(evaluation.ageYears).toBeGreaterThanOrEqual(8);
  });

  it('classifies newly published package as active/emerging lifecycle', () => {
    const recentDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(); // 6 months ago
    const meta: PackageMetadata = {
      name: 'new-awesome-tool',
      version: '1.2.0',
      latestVersion: '1.2.0',
      publishedAt: recentDate,
      releaseCount: 3,
      isDeprecated: false,
      hasProvenance: true,
      versionsTime: {
        '1.0.0': recentDate,
      },
    };

    const evaluation = evaluatePackageMaturity(meta);
    expect(evaluation.isMatureStable).toBe(false);
  });

  it('never classifies deprecated package as mature-stable', () => {
    const meta: PackageMetadata = {
      name: 'request',
      version: '2.88.2',
      latestVersion: '2.88.2',
      publishedAt: '2020-02-11T00:00:00.000Z',
      releaseCount: 150,
      isDeprecated: true,
      deprecationReason: 'request has been deprecated',
      hasProvenance: false,
      versionsTime: {
        '0.1.0': '2011-01-01T00:00:00.000Z',
      },
    };

    const evaluation = evaluatePackageMaturity(meta);
    expect(evaluation.isMatureStable).toBe(false);
  });
});
