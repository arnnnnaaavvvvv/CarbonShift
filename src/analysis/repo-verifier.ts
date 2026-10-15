import type { RepoAssociationStatus } from '../core/types.js';

export interface ParsedRepoInfo {
  readonly owner: string;
  readonly repo: string;
}

/**
 * Extracts normalized owner and repo from a package repository URL.
 * Supports git+, ssh, github: shorthand, and standard https GitHub URLs.
 */
export function parseGitHubRepoUrl(rawUrl: string | undefined): ParsedRepoInfo | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();

  // Shorthand e.g. "github:foo/bar"
  if (trimmed.startsWith('github:')) {
    const parts = trimmed.slice('github:'.length).replace(/\.git$/, '').split('/');
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
  }

  // Standard git or https url: github.com/owner/repo
  const match = /github\.com[/:]([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+?)(?:\.git|\/|$)/i.exec(trimmed);
  if (match && match[1] && match[2]) {
    return {
      owner: match[1],
      repo: match[2],
    };
  }

  return null;
}

/**
 * Verifies that the claimed GitHub repository legitimately corresponds to the npm package.
 * Defends against typosquats pointing repository metadata to popular open-source repos.
 */
export function verifyRepoIdentity(
  packageName: string,
  owner: string,
  repo: string,
  hasProvenance: boolean,
): { associationStatus: RepoAssociationStatus; unverifiedReason?: string | undefined } {
  // If npm provenance attestation was verified cryptographically by npm, repo is verified
  if (hasProvenance) {
    return { associationStatus: 'verified' };
  }

  const cleanPkgName = packageName.startsWith('@')
    ? (packageName.split('/')[1] ?? packageName)
    : packageName;

  const cleanRepoName = repo.toLowerCase();
  const pkgLower = cleanPkgName.toLowerCase();

  // Exact match between package name and repo name
  if (cleanRepoName === pkgLower || cleanRepoName === `node-${pkgLower}` || cleanRepoName === `${pkgLower}.js`) {
    return { associationStatus: 'verified' };
  }

  // Scoped organization repo match (e.g. @angular/core -> angular/angular)
  if (packageName.startsWith('@')) {
    const orgScope = packageName.split('/')[0]?.replace('@', '').toLowerCase();
    if (orgScope && (owner.toLowerCase() === orgScope || cleanRepoName === orgScope)) {
      return { associationStatus: 'verified' };
    }
  }

  // Known high-profile monorepos (babel, react, typescript, jest, etc.)
  const knownMonorepos = new Set(['babel', 'react', 'jest', 'vue', 'next.js', 'svelte']);
  if (knownMonorepos.has(cleanRepoName)) {
    // If the package does not belong to the official org/scope, flag as divergent
    return {
      associationStatus: 'divergent',
      unverifiedReason: `Package ${packageName} claims monorepo ${owner}/${repo} without verified provenance or matching scope.`,
    };
  }

  // Divergent / ambiguous
  return {
    associationStatus: 'unverified',
    unverifiedReason: `Repository name '${repo}' differs from package name '${packageName}' and lacks cryptographic provenance.`,
  };
}
