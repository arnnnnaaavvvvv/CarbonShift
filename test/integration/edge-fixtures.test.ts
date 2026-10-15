import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { DepPulseEngine } from '../../src/core/engine.js';
import { getDefaultConfig } from '../../src/core/config.js';
import { DiskCacheStore } from '../../src/cache/disk-store.js';

describe('Integration: Edge Fixtures & Failure Tolerance', () => {
  let tmpDir: string;
  let tmpCacheDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-edge-'));
    tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-edge-cache-'));
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.rm(tmpCacheDir, { recursive: true, force: true });
  });

  it('handles completely empty project (zero dependencies) cleanly', async () => {
    const manifest = {
      name: 'empty-app',
      version: '1.0.0',
    };
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));

    const engine = new DepPulseEngine();
    const report = await engine.scan(tmpDir);

    expect(report.scannedDependenciesCount).toBe(0);
    expect(report.summary.lowRisk).toBe(0);
    expect(report.summary.criticalRisk).toBe(0);
    expect(report.policyResult.isPassed).toBe(true);
  });

  it('handles scoped packages (@types/node) correctly', async () => {
    const manifest = {
      name: 'scoped-app',
      dependencies: {
        '@types/node': '^20.0.0',
      },
    };
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));

    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('@types%2Fnode') || url.includes('@types/node')) {
        return new Response(
          JSON.stringify({
            name: '@types/node',
            'dist-tags': { latest: '20.12.0' },
            versions: {
              '20.12.0': {
                name: '@types/node',
                version: '20.12.0',
                repository: { type: 'git', url: 'https://github.com/DefinitelyTyped/DefinitelyTyped.git' },
              },
            },
            time: {
              '20.12.0': new Date().toISOString(),
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    });

    const cacheStore = new DiskCacheStore({ dir: tmpCacheDir, enabled: false });
    const engine = new DepPulseEngine(getDefaultConfig(), { cacheStore });
    const report = await engine.scan(tmpDir);

    expect(report.scannedDependenciesCount).toBe(1);
    expect(report.results[0]?.dependency.name).toBe('@types/node');
    expect(report.results[0]?.score).not.toBeNull();
  });

  it('tolerates upstream network outages gracefully without crashing the scan', async () => {
    const manifest = {
      name: 'resilient-app',
      dependencies: {
        'flaky-lib': '^1.0.0',
      },
    };
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));

    // Force network rejection
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Simulated upstream network down'));

    const cacheStore = new DiskCacheStore({ dir: tmpCacheDir, enabled: false });
    const config = {
      ...getDefaultConfig(),
      network: {
        ...getDefaultConfig().network,
        maxRetries: 0,
      },
    };
    const engine = new DepPulseEngine(config, { cacheStore });
    const report = await engine.scan(tmpDir);

    expect(report.scannedDependenciesCount).toBe(1);
    const result = report.results[0];
    expect(result?.maintenanceRisk).toBe('unknown');
    expect(result?.score).toBeNull();
    expect(result?.confidence).toBeLessThan(0.35);
  });
});
