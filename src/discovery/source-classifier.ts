import type { DependencySource } from '../core/types.js';

const GIT_PREFIXES = ['git+', 'git://', 'github:', 'gitlab:', 'bitbucket:'];
const FILE_PREFIXES = ['file:', 'link:'];

/**
 * Classifies the source of a dependency based on its declared specifier or range.
 */
export function classifyDependencySource(
  specifier: string,
  workspacePackageNames: ReadonlySet<string> = new Set(),
): DependencySource {
  const trimmed = specifier.trim();

  if (trimmed.startsWith('workspace:') || workspacePackageNames.has(trimmed)) {
    return 'workspace';
  }

  if (trimmed.startsWith('npm:')) {
    return 'alias';
  }

  for (const prefix of FILE_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return 'file';
    }
  }

  for (const prefix of GIT_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      return 'git';
    }
  }

  if (trimmed.includes('github.com') || trimmed.includes('.git')) {
    return 'git';
  }

  // Standard semver or version tags
  if (
    /^[~^<>=v0-9*]/.test(trimmed) ||
    trimmed === '*' ||
    trimmed === 'latest' ||
    trimmed === 'next' ||
    trimmed === 'beta' ||
    trimmed === 'alpha'
  ) {
    return 'npm';
  }

  return 'unknown';
}
