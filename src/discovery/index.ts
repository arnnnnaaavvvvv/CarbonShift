import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parseManifest } from './manifest.js';
import { findAndParseLockfile } from './lockfiles/resolver.js';
import type { DiscoveryResult, SkippedDependency } from './types.js';
import type { DependencyRecord } from '../core/types.js';
import semver from 'semver';

export interface DiscoveryOptions {
  includeDev?: boolean;
  includeTransitive?: boolean;
}

export async function discoverDependencies(
  projectDirOrManifest: string,
  options: DiscoveryOptions = {},
): Promise<DiscoveryResult> {
  const includeDev = options.includeDev ?? true;
  const includeTransitive = options.includeTransitive ?? true;

  let projectDir = projectDirOrManifest;
  try {
    const stat = await fs.stat(projectDirOrManifest);
    if (!stat.isDirectory()) {
      projectDir = path.dirname(projectDirOrManifest);
    }
  } catch {
    // If path doesn't exist, parseManifest will throw standard DiscoveryError
  }

  const manifest = await parseManifest(projectDirOrManifest);
  const lockfile = await findAndParseLockfile(projectDir);

  const dependencies: DependencyRecord[] = [];
  const skipped: SkippedDependency[] = [];
  const warnings: string[] = [...(lockfile?.warnings ?? [])];

  const directNames = new Set<string>();

  // 1. Process direct dependencies from package.json
  for (const declared of manifest.declaredDependencies) {
    if (declared.type === 'dev' && !includeDev) {
      continue;
    }

    if (declared.source === 'workspace') {
      skipped.push({
        name: declared.name,
        declaredRange: declared.range,
        reason: 'private_workspace',
        explanation: 'Local workspace package; internal source code is not published to public npm.',
      });
      continue;
    }

    if (declared.source === 'file' || declared.source === 'git') {
      skipped.push({
        name: declared.name,
        declaredRange: declared.range,
        reason: 'unsupported_source',
        explanation: `Non-npm source (${declared.source}); public registry telemetry is unavailable.`,
      });
      continue;
    }

    if (declared.source === 'alias') {
      skipped.push({
        name: declared.name,
        declaredRange: declared.range,
        reason: 'unsupported_source',
        explanation: `npm alias dependency (${declared.range}); direct registry telemetry lookup is skipped.`,
      });
      continue;
    }

    if (declared.source === 'unknown') {
      skipped.push({
        name: declared.name,
        declaredRange: declared.range,
        reason: 'unsupported_source',
        explanation: `Unrecognized dependency source format (${declared.range}); public registry telemetry is unavailable.`,
      });
      continue;
    }

    directNames.add(declared.name);

    // Resolve version from lockfile if available, otherwise check if declared range is a clean version
    let resolvedVersion = '';
    const lockfileEntry = lockfile?.packages.get(declared.name);
    if (lockfileEntry?.resolvedVersion) {
      resolvedVersion = lockfileEntry.resolvedVersion;
    } else {
      const cleanVer = semver.clean(declared.range);
      if (cleanVer) {
        resolvedVersion = cleanVer;
      } else {
        // Range like ^1.0.0 without lockfile
        resolvedVersion = declared.range;
      }
    }

    dependencies.push({
      id: `${declared.name}@${resolvedVersion || declared.range}`,
      name: declared.name,
      declaredRange: declared.range,
      resolvedVersion: resolvedVersion || declared.range,
      type: declared.type,
      source: declared.source,
      registryUrl: 'https://registry.npmjs.org',
      isDirect: true,
      dependents: [],
    });
  }

  // 2. Process transitive dependencies from lockfile
  if (includeTransitive && lockfile) {
    for (const [name, entry] of lockfile.packages.entries()) {
      if (directNames.has(name) || entry.isDirect) {
        continue; // Already processed as direct
      }

      dependencies.push({
        id: `${name}@${entry.resolvedVersion}`,
        name,
        declaredRange: entry.resolvedVersion,
        resolvedVersion: entry.resolvedVersion,
        type: 'transitive',
        source: 'npm',
        registryUrl: 'https://registry.npmjs.org',
        isDirect: false,
        dependents: entry.dependents,
      });
    }
  }

  const coverage = lockfile ? lockfile.coverage : 'direct-only';
  if (!lockfile) {
    warnings.push(
      'No lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock) found. Running in direct-only coverage mode.',
    );
  }

  return {
    manifestPath: manifest.path,
    manifest,
    lockfilePath: lockfile?.path,
    lockfileFormat: lockfile?.format,
    coverage,
    dependencies,
    skipped,
    warnings,
  };
}

export * from './types.js';
export * from './manifest.js';
export * from './source-classifier.js';
export * from './lockfiles/npm.js';
export * from './lockfiles/pnpm-yarn.js';
export * from './lockfiles/resolver.js';
