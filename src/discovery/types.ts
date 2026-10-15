import type { DependencyRecord, DependencySource, DependencyType } from '../core/types.js';

export interface RawPackageJson {
  readonly name?: string | undefined;
  readonly version?: string | undefined;
  readonly private?: boolean | undefined;
  readonly workspaces?: string[] | { packages?: string[] | undefined } | undefined;
  readonly dependencies?: Record<string, string> | undefined;
  readonly devDependencies?: Record<string, string> | undefined;
  readonly peerDependencies?: Record<string, string> | undefined;
  readonly optionalDependencies?: Record<string, string> | undefined;
  readonly engines?: { node?: string | undefined; npm?: string | undefined } | undefined;
}

export interface ProjectManifest {
  readonly path: string;
  readonly raw: RawPackageJson;
  readonly name?: string | undefined;
  readonly version?: string | undefined;
  readonly isPrivate: boolean;
  readonly workspaces: readonly string[];
  readonly declaredDependencies: readonly {
    readonly name: string;
    readonly range: string;
    readonly type: DependencyType;
    readonly source: DependencySource;
  }[];
}

export type LockfileFormat =
  | 'npm-v1'
  | 'npm-v2'
  | 'npm-v3'
  | 'npm-shrinkwrap'
  | 'yarn-v1'
  | 'yarn-v2'
  | 'pnpm-v5'
  | 'pnpm-v6'
  | 'pnpm-v9'
  | 'unsupported';

export interface ResolvedPackageEntry {
  readonly name: string;
  readonly resolvedVersion: string;
  readonly integrity?: string | undefined;
  readonly isDirect: boolean;
  readonly dependents: readonly string[];
  readonly dependencies?: Record<string, string> | undefined;
}

export interface ParsedLockfile {
  readonly path: string;
  readonly format: LockfileFormat;
  readonly lockfileVersion: number | string;
  readonly packages: ReadonlyMap<string, ResolvedPackageEntry>;
  readonly coverage: 'full' | 'partial' | 'direct-only';
  readonly warnings: readonly string[];
}

export interface SkippedDependency {
  readonly name: string;
  readonly declaredRange: string;
  readonly reason: 'ignored_by_config' | 'private_workspace' | 'unsupported_source' | 'unresolved';
  readonly explanation: string;
}

export interface DiscoveryResult {
  readonly manifestPath: string;
  readonly manifest: ProjectManifest;
  readonly lockfilePath?: string | undefined;
  readonly lockfileFormat?: LockfileFormat | undefined;
  readonly coverage: 'full' | 'partial' | 'direct-only';
  readonly dependencies: readonly DependencyRecord[];
  readonly skipped: readonly SkippedDependency[];
  readonly warnings: readonly string[];
}
