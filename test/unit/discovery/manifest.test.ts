import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { parseManifest } from '../../../src/discovery/manifest.js';
import { DiscoveryError } from '../../../src/core/errors.js';

describe('Manifest Parser', () => {
  let tmpDir: string;

  it('correctly parses package.json with all 4 dependency types and workspaces', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-manifest-test-'));
    const manifestContent = {
      name: 'root-project',
      version: '1.0.0',
      private: true,
      workspaces: ['packages/*'],
      dependencies: {
        express: '^4.19.2',
        'local-pkg': 'workspace:*',
      },
      devDependencies: {
        typescript: '^5.4.0',
      },
      peerDependencies: {
        react: '>=18.0.0',
      },
      optionalDependencies: {
        fsevents: '~2.3.2',
      },
    };

    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify(manifestContent));

    const result = await parseManifest(tmpDir);
    expect(result.name).toBe('root-project');
    expect(result.version).toBe('1.0.0');
    expect(result.isPrivate).toBe(true);
    expect(result.workspaces).toEqual(['packages/*']);
    expect(result.declaredDependencies).toHaveLength(5);

    const expressDep = result.declaredDependencies.find(d => d.name === 'express');
    expect(expressDep).toMatchObject({
      name: 'express',
      range: '^4.19.2',
      type: 'prod',
      source: 'npm',
    });

    const localDep = result.declaredDependencies.find(d => d.name === 'local-pkg');
    expect(localDep?.source).toBe('workspace');

    const tsDep = result.declaredDependencies.find(d => d.name === 'typescript');
    expect(tsDep?.type).toBe('dev');

    const reactDep = result.declaredDependencies.find(d => d.name === 'react');
    expect(reactDep?.type).toBe('peer');

    const fseventsDep = result.declaredDependencies.find(d => d.name === 'fsevents');
    expect(fseventsDep?.type).toBe('optional');

    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('throws DiscoveryError on missing package.json', async () => {
    const nonexistent = path.join(os.tmpdir(), 'nonexistent-deppulse-dir-12345');
    await expect(parseManifest(nonexistent)).rejects.toThrow(DiscoveryError);
  });

  it('throws DiscoveryError on malformed JSON with recovery hint', async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deppulse-malformed-test-'));
    await fs.writeFile(path.join(tmpDir, 'package.json'), '{ "name": "bad", trailingComma: true, }');

    await expect(parseManifest(tmpDir)).rejects.toThrow(DiscoveryError);
    try {
      await parseManifest(tmpDir);
    } catch (err) {
      expect(err).toBeInstanceOf(DiscoveryError);
      expect((err as DiscoveryError).recoveryHint).toContain('JSON syntax');
    }

    await fs.rm(tmpDir, { recursive: true, force: true });
  });
});
