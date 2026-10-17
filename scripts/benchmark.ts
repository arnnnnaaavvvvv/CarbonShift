import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DepPulseEngine } from '../src/core/engine.js';
import { getDefaultConfig } from '../src/core/config.js';
import { DiskCacheStore } from '../src/cache/disk-store.js';

interface BenchmarkMetrics {
  dependencyCount: number;
  coldDurationMs: number;
  warmDurationMs: number;
  networkRequestsCold: number;
  networkRequestsWarm: number;
  coldCacheHitRate: number;
  warmCacheHitRate: number;
  peakHeapUsedMB: number;
  simulatedErrorFailureRate: number;
}

async function createSyntheticProject(
  targetDir: string,
  count: number,
): Promise<{ directCount: number; transitiveCount: number }> {
  const directCount = Math.min(count, Math.max(10, Math.floor(count * 0.2)));
  const transitiveCount = count - directCount;

  const dependencies: Record<string, string> = {};
  const packages: Record<string, unknown> = {
    '': {
      name: `benchmark-app-${count}`,
      dependencies: {},
    },
  };

  // Generate direct dependencies
  for (let i = 1; i <= directCount; i++) {
    const pkgName = `direct-lib-${i}`;
    dependencies[pkgName] = `^1.0.0`;
    (packages[''] as { dependencies: Record<string, string> }).dependencies[pkgName] = '^1.0.0';

    packages[`node_modules/${pkgName}`] = {
      version: '1.0.0',
      dependencies: i <= transitiveCount ? { [`transitive-lib-${i}`]: '^2.0.0' } : undefined,
    };
  }

  // Generate transitive dependencies
  for (let i = 1; i <= transitiveCount; i++) {
    const pkgName = `transitive-lib-${i}`;
    packages[`node_modules/${pkgName}`] = {
      version: '2.0.0',
    };
  }

  await fs.writeFile(
    path.join(targetDir, 'package.json'),
    JSON.stringify({ name: `benchmark-app-${count}`, dependencies }, null, 2),
  );
  await fs.writeFile(
    path.join(targetDir, 'package-lock.json'),
    JSON.stringify({ name: `benchmark-app-${count}`, lockfileVersion: 3, packages }, null, 2),
  );

  return { directCount, transitiveCount };
}

export async function runBenchmarkForSize(count: number): Promise<BenchmarkMetrics> {
  const tmpProjectDir = await fs.mkdtemp(path.join(os.tmpdir(), `deppulse-bench-${count}-`));
  const tmpCacheDir = await fs.mkdtemp(path.join(os.tmpdir(), `deppulse-bench-cache-${count}-`));

  await createSyntheticProject(tmpProjectDir, count);

  let networkCalls = 0;
  const originalFetch = globalThis.fetch;

  // Mock standard registry response generator
  globalThis.fetch = async (url: string | URL | Request) => {
    networkCalls++;
    const urlStr = typeof url === 'string' ? url : url.toString();
    const cleanPkg = urlStr.split('/').pop()?.split('@')[0] ?? 'lib';

    return new Response(
      JSON.stringify({
        name: cleanPkg,
        'dist-tags': { latest: '1.0.0' },
        versions: {
          '1.0.0': {
            name: cleanPkg,
            version: '1.0.0',
            engines: { node: '>=18.0.0' },
          },
        },
        time: { '1.0.0': new Date().toISOString() },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const initialHeap = process.memoryUsage().heapUsed;
  let peakHeap = initialHeap;

  const trackHeap = () => {
    const current = process.memoryUsage().heapUsed;
    if (current > peakHeap) peakHeap = current;
  };

  const heapInterval = setInterval(trackHeap, 10);

  // 1. Cold Scan
  networkCalls = 0;
  const cacheStore = new DiskCacheStore({ dir: tmpCacheDir, enabled: true });
  const config = {
    ...getDefaultConfig(),
    network: {
      ...getDefaultConfig().network,
      concurrency: 16,
    },
  };

  const engine = new DepPulseEngine(config, { cacheStore });

  const startCold = performance.now();
  const coldReport = await engine.scan(tmpProjectDir);
  const coldDurationMs = Math.round(performance.now() - startCold);
  const networkRequestsCold = networkCalls;
  const coldCacheHitRate = 0; // Cold start

  // 2. Warm Scan (Hits Cache)
  networkCalls = 0;
  const startWarm = performance.now();
  const warmReport = await engine.scan(tmpProjectDir);
  const warmDurationMs = Math.round(performance.now() - startWarm);
  const networkRequestsWarm = networkCalls;
  const warmCacheHitRate =
    warmReport.scannedDependenciesCount > 0
      ? Math.round(((warmReport.scannedDependenciesCount - networkCalls) / warmReport.scannedDependenciesCount) * 100)
      : 100;

  // 3. Simulated Network Outage Test (10% random network dropout)
  let _simulatedAttempts = 0;
  let _simulatedErrors = 0;
  globalThis.fetch = async () => {
    _simulatedAttempts++;
    if (Math.random() < 0.1) {
      _simulatedErrors++;
      throw new Error('Simulated transient socket timeout');
    }
    return new Response(
      JSON.stringify({
        name: 'test-lib',
        'dist-tags': { latest: '1.0.0' },
        versions: { '1.0.0': { version: '1.0.0' } },
        time: { '1.0.0': new Date().toISOString() },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  const resilientCache = new DiskCacheStore({ dir: tmpCacheDir, enabled: false });
  const resilientEngine = new DepPulseEngine(
    {
      ...config,
      network: {
        ...config.network,
        maxRetries: 1,
      },
    },
    { cacheStore: resilientCache },
  );

  const dropoutReport = await resilientEngine.scan(tmpProjectDir);
  const failureCount = dropoutReport.results.filter(r => r.maintenanceRisk === 'unknown').length;
  const simulatedErrorFailureRate =
    dropoutReport.scannedDependenciesCount > 0
      ? Number(((failureCount / dropoutReport.scannedDependenciesCount) * 100).toFixed(1))
      : 0;

  clearInterval(heapInterval);
  globalThis.fetch = originalFetch;

  await fs.rm(tmpProjectDir, { recursive: true, force: true });
  await fs.rm(tmpCacheDir, { recursive: true, force: true });

  return {
    dependencyCount: coldReport.scannedDependenciesCount,
    coldDurationMs,
    warmDurationMs,
    networkRequestsCold,
    networkRequestsWarm,
    coldCacheHitRate,
    warmCacheHitRate,
    peakHeapUsedMB: Number(((peakHeap - initialHeap) / (1024 * 1024)).toFixed(2)),
    simulatedErrorFailureRate,
  };
}

async function main() {
  // eslint-disable-next-line no-console
  console.log('\n--- Running DepPulse Realistic Scaling Benchmarks ---');
  const sizes = [50, 500, 1500];
  const results: BenchmarkMetrics[] = [];

  for (const s of sizes) {
    // eslint-disable-next-line no-console
    console.log(`Benchmarking graph of ~${s} dependencies...`);
    const res = await runBenchmarkForSize(s);
    results.push(res);
  }

  // eslint-disable-next-line no-console
  console.log('\n### BENCHMARK RESULTS TABLE\n');
  // eslint-disable-next-line no-console
  console.table(results);
}

if (process.argv[1]?.endsWith('benchmark.ts') || process.argv[1]?.endsWith('benchmark.js')) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
