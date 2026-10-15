import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { DepPulseEngine } from '../../src/core/engine.js';
import { getDefaultConfig } from '../../src/core/config.js';
import { DiskCacheStore } from '../../src/cache/disk-store.js';

describe('Integration: Full Scan & Read-Only Guarantee', () => {
  let tmpDir: string;
  let tmpCacheDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-full-scan-'));
    tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-scan-cache-'));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('executes end-to-end scan with mocked HTTP and satisfies read-only guarantee', async () => {
    // 1. Create realistic project files
    const manifest = {
      name: 'fixture-app',
      version: '1.0.0',
      dependencies: {
        express: '^4.19.2',
        wrappy: '^1.0.2',
        request: '^2.88.2',
      },
    };

    const lockfile = {
      name: 'fixture-app',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'fixture-app',
          dependencies: {
            express: '^4.19.2',
            wrappy: '^1.0.2',
            request: '^2.88.2',
          },
        },
        'node_modules/express': {
          version: '4.19.2',
          dependencies: { accepts: '~1.3.8' },
        },
        'node_modules/accepts': {
          version: '1.3.8',
        },
        'node_modules/wrappy': {
          version: '1.0.2',
        },
        'node_modules/request': {
          version: '2.88.2',
        },
      },
    };

    const manifestPath = path.join(tmpDir, 'package.json');
    const lockfilePath = path.join(tmpDir, 'package-lock.json');

    const manifestContent = JSON.stringify(manifest, null, 2);
    const lockfileContent = JSON.stringify(lockfile, null, 2);

    await fs.writeFile(manifestPath, manifestContent);
    await fs.writeFile(lockfilePath, lockfileContent);

    const manifestHashBefore = crypto.createHash('sha256').update(manifestContent).digest('hex');
    const lockfileHashBefore = crypto.createHash('sha256').update(lockfileContent).digest('hex');

    // 2. Mock HTTP responses for npm registry, github, and osv
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/express')) {
        return new Response(
          JSON.stringify({
            name: 'express',
            'dist-tags': { latest: '4.19.2' },
            versions: {
              '4.19.2': {
                name: 'express',
                version: '4.19.2',
                engines: { node: '>= 0.10.0' },
                repository: { type: 'git', url: 'https://github.com/expressjs/express.git' },
              },
            },
            time: {
              '0.1.0': '2010-01-01T00:00:00.000Z',
              '4.19.2': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/wrappy')) {
        return new Response(
          JSON.stringify({
            name: 'wrappy',
            'dist-tags': { latest: '1.0.2' },
            versions: {
              '1.0.2': {
                name: 'wrappy',
                version: '1.0.2',
                engines: { node: '>=0.10.0' },
                repository: { type: 'git', url: 'https://github.com/npm/wrappy.git' },
              },
            },
            time: {
              '0.1.0': '2014-01-01T00:00:00.000Z',
              '0.1.1': '2014-06-01T00:00:00.000Z',
              '0.1.2': '2014-12-01T00:00:00.000Z',
              '0.1.3': '2015-03-01T00:00:00.000Z',
              '1.0.0': '2015-06-01T00:00:00.000Z',
              '1.0.1': '2015-09-01T00:00:00.000Z',
              '1.0.2': '2016-05-18T00:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/request')) {
        return new Response(
          JSON.stringify({
            name: 'request',
            'dist-tags': { latest: '2.88.2' },
            versions: {
              '2.88.2': {
                name: 'request',
                version: '2.88.2',
                deprecated: 'request has been deprecated',
                repository: { type: 'git', url: 'https://github.com/request/request.git' },
              },
            },
            time: {
              '0.1.0': '2011-01-01T00:00:00.000Z',
              '2.88.2': '2020-02-11T00:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('/accepts')) {
        return new Response(
          JSON.stringify({
            name: 'accepts',
            'dist-tags': { latest: '1.3.8' },
            versions: {
              '1.3.8': {
                name: 'accepts',
                version: '1.3.8',
                engines: { node: '>= 0.6' },
                repository: { type: 'git', url: 'https://github.com/jshttp/accepts.git' },
              },
            },
            time: {
              '1.3.8': '2022-01-01T00:00:00.000Z',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('api.github.com/repos/request/request')) {
        return new Response(
          JSON.stringify({
            archived: true,
            fork: false,
            stargazers_count: 25000,
            open_issues_count: 50,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (url.includes('api.github.com/repos/')) {
        return new Response(
          JSON.stringify({
            archived: false,
            fork: false,
            stargazers_count: 2000,
            open_issues_count: 10,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    });

    // 3. Run Engine Scan
    const cacheStore = new DiskCacheStore({ dir: tmpCacheDir, enabled: true });
    const config = getDefaultConfig();
    const engine = new DepPulseEngine(config, { cacheStore });

    const report = await engine.scan(tmpDir);

    expect(report.scannedDependenciesCount).toBe(4);
    expect(report.directCount).toBe(3);
    expect(report.transitiveCount).toBe(1);
    expect(report.coverage).toBe('full');

    const requestResult = report.results.find(r => r.dependency.name === 'request');
    expect(requestResult?.maintenanceRisk).toBe('critical');
    expect(requestResult?.score).toBeLessThanOrEqual(20);

    const wrappyResult = report.results.find(r => r.dependency.name === 'wrappy');
    expect(wrappyResult?.isMatureStable).toBe(true);
    expect(wrappyResult?.maintenanceRisk).toBe('low');
    expect(wrappyResult?.score).toBeGreaterThanOrEqual(80);

    const expressResult = report.results.find(r => r.dependency.name === 'express');
    expect(expressResult?.maintenanceRisk).toBe('low');

    // 4. Verify Read-Only Guarantee (Files must NOT be modified in any way)
    const manifestAfter = await fs.readFile(manifestPath, 'utf-8');
    const lockfileAfter = await fs.readFile(lockfilePath, 'utf-8');

    const manifestHashAfter = crypto.createHash('sha256').update(manifestAfter).digest('hex');
    const lockfileHashAfter = crypto.createHash('sha256').update(lockfileAfter).digest('hex');

    expect(manifestHashAfter).toBe(manifestHashBefore);
    expect(lockfileHashAfter).toBe(lockfileHashBefore);
  });
});
