import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { parseNpmLockfile } from '../../../src/discovery/lockfiles/npm.js';
import { parsePnpmLockfile, parseYarnLockfile } from '../../../src/discovery/lockfiles/pnpm-yarn.js';
import { discoverDependencies } from '../../../src/discovery/index.js';

describe('Lockfile Parsers and Discovery Orchestrator', () => {
  let tmpDir: string;

  it('correctly parses npm lockfileVersion 2/3 and separates direct vs transitive', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-npm-v3-'));
    const manifest = {
      name: 'test-app',
      dependencies: {
        express: '^4.19.2',
      },
    };
    const lockfile = {
      name: 'test-app',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'test-app',
          dependencies: {
            express: '^4.19.2',
          },
        },
        'node_modules/express': {
          version: '4.19.2',
          dependencies: {
            'accepts': '~1.3.8',
          },
        },
        'node_modules/accepts': {
          version: '1.3.8',
        },
      },
    };

    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));
    await fs.writeFile(path.join(tmpDir, 'package-lock.json'), JSON.stringify(lockfile));

    const parsedLock = await parseNpmLockfile(path.join(tmpDir, 'package-lock.json'));
    expect(parsedLock.format).toBe('npm-v3');
    expect(parsedLock.coverage).toBe('full');
    expect(parsedLock.packages.get('express')?.isDirect).toBe(true);
    expect(parsedLock.packages.get('accepts')?.isDirect).toBe(false);
    expect(parsedLock.packages.get('accepts')?.dependents).toContain('express');

    // Test overall discovery
    const discovery = await discoverDependencies(tmpDir);
    expect(discovery.coverage).toBe('full');
    expect(discovery.lockfileFormat).toBe('npm-v3');
    expect(discovery.dependencies).toHaveLength(2);

    const direct = discovery.dependencies.find(d => d.name === 'express');
    expect(direct?.isDirect).toBe(true);
    expect(direct?.resolvedVersion).toBe('4.19.2');

    const transitive = discovery.dependencies.find(d => d.name === 'accepts');
    expect(transitive?.isDirect).toBe(false);
    expect(transitive?.type).toBe('transitive');
    expect(transitive?.dependents).toContain('express');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('correctly parses npm lockfileVersion 1 (recursive dependencies)', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-npm-v1-'));
    const lockfileV1 = {
      name: 'v1-app',
      lockfileVersion: 1,
      dependencies: {
        lodash: {
          version: '4.17.21',
        },
        debug: {
          version: '4.3.4',
          requires: {
            ms: '2.1.2',
          },
          dependencies: {
            ms: {
              version: '2.1.2',
            },
          },
        },
      },
    };

    const lockPath = path.join(tmpDir, 'package-lock.json');
    await fs.writeFile(lockPath, JSON.stringify(lockfileV1));

    const parsed = await parseNpmLockfile(lockPath);
    expect(parsed.format).toBe('npm-v1');
    expect(parsed.packages.get('lodash')?.isDirect).toBe(true);
    expect(parsed.packages.get('debug')?.isDirect).toBe(true);
    expect(parsed.packages.get('ms')?.isDirect).toBe(false);
    expect(parsed.packages.get('ms')?.dependents).toContain('debug');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('handles pnpm and yarn lockfiles with explicit partial coverage warnings', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-pnpm-yarn-'));
    const pnpmYaml = `lockfileVersion: 5.4
specifiers:
  chalk: ^5.0.0
packages:
  /chalk@5.3.0:
    resolution: {integrity: sha512-demo}
`;
    const pnpmPath = path.join(tmpDir, 'pnpm-lock.yaml');
    await fs.writeFile(pnpmPath, pnpmYaml);

    const parsedPnpm = await parsePnpmLockfile(pnpmPath);
    expect(parsedPnpm.format).toBe('pnpm-v5');
    expect(parsedPnpm.coverage).toBe('partial');
    expect(parsedPnpm.warnings[0]).toContain('pnpm-lock.yaml');
    expect(parsedPnpm.packages.has('chalk')).toBe(true);

    const yarnPath = path.join(tmpDir, 'yarn.lock');
    await fs.writeFile(yarnPath, '# yarn lockfile v1\n');
    const parsedYarn = await parseYarnLockfile(yarnPath);
    expect(parsedYarn.format).toBe('yarn-v1');
    expect(parsedYarn.coverage).toBe('direct-only');
    expect(parsedYarn.warnings[0]).toContain('yarn.lock detected');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('skips workspace and git dependencies with explicit reason and explanation', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-skipped-'));
    const manifest = {
      name: 'workspace-app',
      dependencies: {
        'internal-ui': 'workspace:*',
        'custom-logger': 'git+https://github.com/my-org/logger.git',
        'safe-npm-pkg': '^1.0.0',
      },
    };
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifest));

    const result = await discoverDependencies(tmpDir);
    expect(result.dependencies).toHaveLength(1);
    expect(result.dependencies[0]?.name).toBe('safe-npm-pkg');

    expect(result.skipped).toHaveLength(2);
    const workspaceSkip = result.skipped.find(s => s.name === 'internal-ui');
    expect(workspaceSkip?.reason).toBe('private_workspace');
    expect(workspaceSkip?.explanation).toBeDefined();

    const gitSkip = result.skipped.find(s => s.name === 'custom-logger');
    expect(gitSkip?.reason).toBe('unsupported_source');
    expect(gitSkip?.explanation).toBeDefined();

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
