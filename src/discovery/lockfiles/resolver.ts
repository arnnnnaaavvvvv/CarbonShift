import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ParsedLockfile } from '../types.js';
import { parseNpmLockfile } from './npm.js';
import { parsePnpmLockfile, parseYarnLockfile } from './pnpm-yarn.js';

export async function findAndParseLockfile(projectDir: string): Promise<ParsedLockfile | null> {
  const shrinkwrapPath = path.join(projectDir, 'npm-shrinkwrap.json');
  try {
    await fs.access(shrinkwrapPath);
    return await parseNpmLockfile(shrinkwrapPath, true);
  } catch {
    // not present
  }

  const npmLockPath = path.join(projectDir, 'package-lock.json');
  try {
    await fs.access(npmLockPath);
    return await parseNpmLockfile(npmLockPath, false);
  } catch {
    // not present
  }

  const pnpmLockPath = path.join(projectDir, 'pnpm-lock.yaml');
  try {
    await fs.access(pnpmLockPath);
    return await parsePnpmLockfile(pnpmLockPath);
  } catch {
    // not present
  }

  const yarnLockPath = path.join(projectDir, 'yarn.lock');
  try {
    await fs.access(yarnLockPath);
    return await parseYarnLockfile(yarnLockPath);
  } catch {
    // not present
  }

  return null;
}
