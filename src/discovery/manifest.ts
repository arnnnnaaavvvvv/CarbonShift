import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DiscoveryError } from '../core/errors.js';
import type { ProjectManifest, RawPackageJson } from './types.js';
import { classifyDependencySource } from './source-classifier.js';
import type { DependencyType } from '../core/types.js';

export async function parseManifest(projectDirOrFilePath: string): Promise<ProjectManifest> {
  let manifestPath = projectDirOrFilePath;

  try {
    const stat = await fs.stat(manifestPath);
    if (stat.isDirectory()) {
      manifestPath = path.join(manifestPath, 'package.json');
    }
  } catch (err) {
    throw new DiscoveryError(
      `Cannot access path: ${projectDirOrFilePath}`,
      'Verify that the directory exists and contains a readable package.json file.',
      { path: projectDirOrFilePath },
      { cause: err },
    );
  }

  let content: string;
  try {
    content = await fs.readFile(manifestPath, 'utf-8');
  } catch (err) {
    throw new DiscoveryError(
      `Failed to read package.json at ${manifestPath}`,
      'Ensure the package.json file exists and has read permissions.',
      { path: manifestPath },
      { cause: err },
    );
  }

  let raw: RawPackageJson;
  try {
    raw = JSON.parse(content) as RawPackageJson;
  } catch (err) {
    throw new DiscoveryError(
      `Malformed package.json syntax in ${manifestPath}`,
      'Fix JSON syntax errors (e.g. trailing commas or unquoted keys) in package.json.',
      { path: manifestPath },
      { cause: err },
    );
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new DiscoveryError(
      `package.json must be a JSON object, received ${Array.isArray(raw) ? 'array' : typeof raw}`,
      'Ensure package.json contains a valid top-level object.',
      { path: manifestPath },
    );
  }

  const workspaces: string[] = [];
  if (Array.isArray(raw.workspaces)) {
    workspaces.push(...raw.workspaces);
  } else if (raw.workspaces && typeof raw.workspaces === 'object' && Array.isArray(raw.workspaces.packages)) {
    workspaces.push(...raw.workspaces.packages);
  }

  const workspacePackagesSet = new Set<string>();
  if (raw.name) {
    workspacePackagesSet.add(raw.name);
  }

  const declaredDependencies: Array<{
    name: string;
    range: string;
    type: DependencyType;
    source: ReturnType<typeof classifyDependencySource>;
  }> = [];

  const typeMap: Array<[DependencyType, Record<string, string> | undefined]> = [
    ['prod', raw.dependencies],
    ['dev', raw.devDependencies],
    ['peer', raw.peerDependencies],
    ['optional', raw.optionalDependencies],
  ];

  for (const [depType, record] of typeMap) {
    if (record && typeof record === 'object' && !Array.isArray(record)) {
      for (const [name, range] of Object.entries(record)) {
        if (typeof range === 'string') {
          declaredDependencies.push({
            name,
            range,
            type: depType,
            source: classifyDependencySource(range, workspacePackagesSet),
          });
        }
      }
    }
  }

  return {
    path: manifestPath,
    raw,
    name: raw.name,
    version: raw.version,
    isPrivate: Boolean(raw.private),
    workspaces,
    declaredDependencies,
  };
}
