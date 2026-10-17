import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';
import { DepPulseEngine } from '../../src/core/engine.js';
import { handleScanCommand } from '../../src/cli/commands/scan.js';

interface FileSnapshot {
  size: number;
  mtimeMs: number;
  hash: string;
}

async function takeDirectorySnapshot(dir: string): Promise<Map<string, FileSnapshot>> {
  const snapshot = new Map<string, FileSnapshot>();

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.relative(dir, fullPath);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        const content = await fs.readFile(fullPath);
        const hash = crypto.createHash('sha256').update(content).digest('hex');
        snapshot.set(relPath, {
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          hash,
        });
      }
    }
  }

  await walk(dir);
  return snapshot;
}

describe('Strict Read-Only Execution: Filesystem Diff Verification', () => {
  let projectDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    projectDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-readonly-test-'));

    // Create realistic project structure
    await fs.writeFile(
      path.join(projectDir, 'package.json'),
      JSON.stringify(
        {
          name: 'readonly-app',
          version: '1.0.0',
          dependencies: {
            express: '^4.19.2',
            lodash: '^4.17.21',
          },
        },
        null,
        2,
      ),
    );

    await fs.writeFile(
      path.join(projectDir, 'package-lock.json'),
      JSON.stringify(
        {
          name: 'readonly-app',
          lockfileVersion: 3,
          packages: {
            '': {
              name: 'readonly-app',
              dependencies: { express: '^4.19.2', lodash: '^4.17.21' },
            },
            'node_modules/express': { version: '4.19.2' },
            'node_modules/lodash': { version: '4.17.21' },
          },
        },
        null,
        2,
      ),
    );

    // Mock fetch - return fresh Response on each call so body stream is not disturbed
    globalThis.fetch = vi.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            name: 'mock',
            'dist-tags': { latest: '1.0.0' },
            versions: { '1.0.0': { version: '1.0.0' } },
            time: { '1.0.0': new Date().toISOString() },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
    );
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await fs.rm(projectDir, { recursive: true, force: true });
  });

  it('verifies that running scan produces zero mutations or file writes on the target project', async () => {
    // 1. Snapshot project directory before scan
    const beforeSnapshot = await takeDirectorySnapshot(projectDir);

    // 2. Execute programmatic Engine Scan
    const engine = new DepPulseEngine();
    await engine.scan(projectDir, { noCache: true });

    // 3. Execute CLI command scan
    await handleScanCommand(projectDir, { format: 'json', noCache: true });

    // 4. Snapshot project directory after scans
    const afterSnapshot = await takeDirectorySnapshot(projectDir);

    // 5. Compare snapshots item by item
    expect(afterSnapshot.size).toBe(beforeSnapshot.size);

    for (const [relPath, beforeStat] of beforeSnapshot.entries()) {
      const afterStat = afterSnapshot.get(relPath);
      expect(afterStat).toBeDefined();
      expect(afterStat?.hash).toBe(beforeStat.hash);
      expect(afterStat?.size).toBe(beforeStat.size);
      expect(afterStat?.mtimeMs).toBe(beforeStat.mtimeMs);
    }
  });
});
