import { promises as fs } from 'node:fs';
import { LockfileParseError } from '../../core/errors.js';
import type { LockfileFormat, ParsedLockfile, ResolvedPackageEntry } from '../types.js';

interface NpmV1DepEntry {
  version?: string;
  integrity?: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmV1DepEntry>;
  dev?: boolean;
}

interface NpmPackageLockRaw {
  name?: string;
  lockfileVersion?: number;
  packages?: Record<
    string,
    {
      name?: string;
      version?: string;
      integrity?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      optionalDependencies?: Record<string, string>;
      link?: boolean;
    }
  >;
  dependencies?: Record<string, NpmV1DepEntry>;
}

/**
 * Extracts a normalized package name from a package-lock.json path.
 * e.g. "node_modules/@scope/pkg" -> "@scope/pkg"
 * e.g. "node_modules/a/node_modules/b" -> "b"
 */
function extractNameFromPath(packagePath: string): string {
  const parts = packagePath.split('node_modules/');
  const lastPart = parts[parts.length - 1] ?? packagePath;
  return lastPart;
}

export async function parseNpmLockfile(
  lockfilePath: string,
  isShrinkwrap = false,
): Promise<ParsedLockfile> {
  let content: string;
  try {
    content = await fs.readFile(lockfilePath, 'utf-8');
  } catch (err) {
    throw new LockfileParseError(
      `Cannot read lockfile at ${lockfilePath}`,
      'Verify that the lockfile exists and has read permissions.',
      { path: lockfilePath },
      { cause: err },
    );
  }

  let raw: NpmPackageLockRaw;
  try {
    raw = JSON.parse(content) as NpmPackageLockRaw;
  } catch (err) {
    throw new LockfileParseError(
      `Malformed lockfile JSON in ${lockfilePath}`,
      'The lockfile contains invalid JSON syntax. Re-run npm install to re-generate it.',
      { path: lockfilePath },
      { cause: err },
    );
  }

  const rawVersion = raw.lockfileVersion ?? 1;
  const lockfileVersion = typeof rawVersion === 'number' ? rawVersion : 1;

  let format: LockfileFormat;
  if (isShrinkwrap) {
    format = 'npm-shrinkwrap';
  } else if (lockfileVersion === 3) {
    format = 'npm-v3';
  } else if (lockfileVersion === 2) {
    format = 'npm-v2';
  } else {
    format = 'npm-v1';
  }

  const packagesMap = new Map<string, ResolvedPackageEntry>();
  const warnings: string[] = [];

  // Parse lockfileVersion 2 & 3 via `packages` map
  if ((lockfileVersion === 2 || lockfileVersion === 3) && raw.packages) {
    const rootPkg = raw.packages[''];
    const directNames = new Set<string>();

    if (rootPkg) {
      if (rootPkg.dependencies) Object.keys(rootPkg.dependencies).forEach(d => directNames.add(d));
      if (rootPkg.devDependencies) Object.keys(rootPkg.devDependencies).forEach(d => directNames.add(d));
      if (rootPkg.peerDependencies) Object.keys(rootPkg.peerDependencies).forEach(d => directNames.add(d));
      if (rootPkg.optionalDependencies) Object.keys(rootPkg.optionalDependencies).forEach(d => directNames.add(d));
    }

    const dependentsGraph = new Map<string, Set<string>>();

    for (const [pkgPath, pkgInfo] of Object.entries(raw.packages)) {
      if (pkgPath === '' || pkgInfo.link) continue; // Skip root and workspace links

      const name = pkgInfo.name ?? extractNameFromPath(pkgPath);
      const version = pkgInfo.version;

      if (!version) continue;

      const subDeps = pkgInfo.dependencies ? { ...pkgInfo.dependencies } : undefined;
      if (subDeps) {
        for (const depName of Object.keys(subDeps)) {
          let set = dependentsGraph.get(depName);
          if (!set) {
            set = new Set();
            dependentsGraph.set(depName, set);
          }
          set.add(name);
        }
      }

      // Check if direct
      const isDirect = directNames.has(name) && !pkgPath.slice('node_modules/'.length).includes('node_modules/');

      // If already added, top-level node_modules/ takes precedence over nested
      const existing = packagesMap.get(name);
      if (!existing || (!existing.isDirect && isDirect)) {
        packagesMap.set(name, {
          name,
          resolvedVersion: version,
          integrity: pkgInfo.integrity,
          isDirect,
          dependents: [],
          dependencies: subDeps,
        });
      }
    }

    // Attach computed dependents
    for (const [name, entry] of packagesMap.entries()) {
      const deps = dependentsGraph.get(name);
      if (deps && deps.size > 0) {
        packagesMap.set(name, {
          ...entry,
          dependents: Array.from(deps),
        });
      }
    }
  } else if (raw.dependencies) {
    // Parse lockfileVersion 1 via recursive `dependencies` map
    const dependentsGraph = new Map<string, Set<string>>();

    function traverseV1(
      depMap: Record<string, NpmV1DepEntry>,
      isTopLevel: boolean,
      parentName?: string,
    ) {
      for (const [name, entry] of Object.entries(depMap)) {
        if (!entry.version) continue;

        if (parentName) {
          let set = dependentsGraph.get(name);
          if (!set) {
            set = new Set();
            dependentsGraph.set(name, set);
          }
          set.add(parentName);
        }

        const existing = packagesMap.get(name);
        if (!existing || (!existing.isDirect && isTopLevel)) {
          packagesMap.set(name, {
            name,
            resolvedVersion: entry.version,
            integrity: entry.integrity,
            isDirect: isTopLevel,
            dependents: [],
          });
        }

        if (entry.dependencies) {
          traverseV1(entry.dependencies, false, name);
        }
      }
    }

    traverseV1(raw.dependencies, true);

    // Attach dependents
    for (const [name, entry] of packagesMap.entries()) {
      const deps = dependentsGraph.get(name);
      if (deps && deps.size > 0) {
        packagesMap.set(name, {
          ...entry,
          dependents: Array.from(deps),
        });
      }
    }
  } else {
    warnings.push(`Lockfile at ${lockfilePath} contains no packages or dependencies map.`);
  }

  return {
    path: lockfilePath,
    format,
    lockfileVersion,
    packages: packagesMap,
    coverage: 'full',
    warnings,
  };
}
