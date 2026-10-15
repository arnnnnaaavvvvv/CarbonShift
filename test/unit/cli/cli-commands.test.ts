import { describe, it, expect, vi } from 'vitest';
import { createProgram } from '../../../src/cli/index.js';
import { handleScanCommand } from '../../../src/cli/commands/scan.js';
import { handleCompareCommand } from '../../../src/cli/commands/compare.js';
import { PolicyViolationError, UsageError } from '../../../src/core/errors.js';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';

describe('CLI Commands & Exit Code Mapping', () => {
  it('registers all required commands in Commander program', () => {
    const program = createProgram();
    const commandNames = program.commands.map(c => c.name());
    expect(commandNames).toContain('scan');
    expect(commandNames).toContain('analyze');
    expect(commandNames).toContain('compare');
    expect(commandNames).toContain('explain');
  });

  it('rejects invalid --format option with UsageError (exit code 2)', async () => {
    // @ts-expect-error testing invalid runtime format
    await expect(handleScanCommand('.', { format: 'xml' })).rejects.toThrow(UsageError);
  });

  it('rejects compare command when required version flags are missing', async () => {
    await expect(handleCompareCommand('lodash', {})).rejects.toThrow(UsageError);
    await expect(handleCompareCommand('lodash', { from: '4.0.0' })).rejects.toThrow(UsageError);
  });

  it('throws PolicyViolationError (mapped to exit code 1) on policy breach', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-cli-test-'));
    const manifest = {
      name: 'cli-test',
      dependencies: {
        'deprecated-pkg': '^1.0.0',
      },
    };
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));

    // Mock global fetch returning deprecated packument
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('deprecated-pkg')) {
        return new Response(
          JSON.stringify({
            name: 'deprecated-pkg',
            'dist-tags': { latest: '1.0.0' },
            versions: {
              '1.0.0': {
                name: 'deprecated-pkg',
                version: '1.0.0',
                deprecated: 'Deprecated library',
              },
            },
            time: { '1.0.0': '2020-01-01T00:00:00.000Z' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
    });

    try {
      await expect(
        handleScanCommand(tmpDir, {
          failOn: 'critical',
          noCache: true,
          format: 'json',
        }),
      ).rejects.toThrow(PolicyViolationError);
    } finally {
      globalThis.fetch = originalFetch;
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
