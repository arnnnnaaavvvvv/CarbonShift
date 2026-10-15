import type { ContextualAdvisory, PackageMetadata, RepoMetadata } from '../core/types.js';

export interface RequestOptions {
  readonly signal?: AbortSignal | undefined;
  readonly timeoutMs?: number | undefined;
  readonly forceRefresh?: boolean | undefined;
}

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  clear(): Promise<void>;
}

export interface NpmRegistryProvider {
  getPackageMeta(packageName: string, targetVersion?: string, options?: RequestOptions): Promise<PackageMetadata>;
}

export interface RepoProvider {
  getRepoMetadata(
    rawRepoUrl: string | undefined,
    expectedPackageName: string,
    options?: RequestOptions,
  ): Promise<RepoMetadata>;
}

export interface AdvisoryProvider {
  getAdvisories(
    packageName: string,
    version: string,
    options?: RequestOptions,
  ): Promise<readonly ContextualAdvisory[]>;
}
