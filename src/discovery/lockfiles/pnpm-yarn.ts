import { promises as fs } from 'node:fs';
import YAML from 'yaml';
import type { LockfileFormat, ParsedLockfile, ResolvedPackageEntry } from '../types.js';

export async function parsePnpmLockfile(lockfilePath: string): Promise<ParsedLockfile> {
  let content: string;
  try {
    content = await fs.readFile(lockfilePath, 'utf-8');
  } catch {
    return {
      path: lockfilePath,
      format: 'unsupported',
      lockfileVersion: 'unknown',
      packages: new Map(),
      coverage: 'direct-only',
      warnings: [`Unable to read pnpm lockfile at ${lockfilePath}`],
    };
  }

  let parsedYaml: Record<string, unknown> | null = null;
  try {
    parsedYaml = YAML.parse(content) as Record<string, unknown>;
  } catch {
    // Malformed YAML
  }

  const rawVersion = parsedYaml?.['lockfileVersion'];
  let format: LockfileFormat = 'pnpm-v6';
  const verStr = String(rawVersion ?? '6');
  if (verStr.startsWith('5')) format = 'pnpm-v5';
  else if (verStr.startsWith('9')) format = 'pnpm-v9';

  const packagesMap = new Map<string, ResolvedPackageEntry>();

  // Extract packages if present in pnpm lockfile
  const packagesBlock = parsedYaml?.['packages'] as Record<string, { resolution?: { integrity?: string } }> | undefined;
  if (packagesBlock && typeof packagesBlock === 'object') {
    for (const [key, val] of Object.entries(packagesBlock)) {
      // Key format in pnpm: e.g. "/lodash@4.17.21" or "lodash@4.17.21" or "/@scope/pkg@1.0.0"
      const cleanKey = key.startsWith('/') ? key.slice(1) : key;
      const lastAt = cleanKey.lastIndexOf('@');
      if (lastAt > 0) {
        const name = cleanKey.slice(0, lastAt);
        const version = cleanKey.slice(lastAt + 1).split('(')[0]?.split('_')[0] ?? '';
        if (name && version && !packagesMap.has(name)) {
          packagesMap.set(name, {
            name,
            resolvedVersion: version,
            integrity: val.resolution?.integrity,
            isDirect: false,
            dependents: [],
          });
        }
      }
    }
  }

  return {
    path: lockfilePath,
    format,
    lockfileVersion: verStr,
    packages: packagesMap,
    coverage: packagesMap.size > 0 ? 'partial' : 'direct-only',
    warnings: [
      `pnpm-lock.yaml (${format}) detected: providing partial resolution coverage. Full pnpm virtual-store resolution is scheduled for v1.1.`,
    ],
  };
}

export async function parseYarnLockfile(lockfilePath: string): Promise<ParsedLockfile> {
  return {
    path: lockfilePath,
    format: 'yarn-v1',
    lockfileVersion: '1',
    packages: new Map(),
    coverage: 'direct-only',
    warnings: [
      `yarn.lock detected: deep yarn lockfile AST resolution is scheduled for v1.1. Analyzing direct dependencies from package.json.`,
    ],
  };
}
