import type { PackageMetadata } from '../../core/types.js';
import type { CacheStore, NpmRegistryProvider, RequestOptions } from '../types.js';
import type { ResilientHttpClient } from '../http/client.js';

interface RawPackumentVersion {
  name: string;
  version: string;
  description?: string;
  license?: string;
  deprecated?: string | boolean;
  engines?: { node?: string; npm?: string };
  peerDependencies?: Record<string, string>;
  repository?: { type?: string; url?: string; directory?: string } | string;
  dist?: {
    attestations?: { url?: string; provenance?: { predicateType?: string } };
    signatures?: Array<{ keyid: string; sig: string }>;
  };
}

interface RawPackument {
  name: string;
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, RawPackumentVersion>;
  time?: Record<string, string>;
  repository?: { type?: string; url?: string; directory?: string } | string;
  license?: string;
  description?: string;
}

export class DefaultNpmRegistryProvider implements NpmRegistryProvider {
  constructor(
    private readonly httpClient: ResilientHttpClient,
    private readonly cache: CacheStore,
    private readonly registryBaseUrl = 'https://registry.npmjs.org',
    private readonly cacheTtlMs = 24 * 60 * 60 * 1000, // 24 hours
  ) {}

  async getPackageMeta(
    packageName: string,
    targetVersion?: string,
    options: RequestOptions = {},
  ): Promise<PackageMetadata> {
    const cacheKey = `npm:packument:${packageName}`;

    if (!options.forceRefresh) {
      const cached = await this.cache.get<PackageMetadata>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const encodedName = packageName.startsWith('@')
      ? `@${encodeURIComponent(packageName.slice(1))}`
      : encodeURIComponent(packageName);

    const url = `${this.registryBaseUrl}/${encodedName}`;
    const raw = await this.httpClient.getJson<RawPackument>(url, {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });

    const latestVersion = raw['dist-tags']?.['latest'] ?? Object.keys(raw.versions ?? {}).pop() ?? '0.0.0';
    const chosenVersion = targetVersion && raw.versions?.[targetVersion] ? targetVersion : latestVersion;
    const versionObj = raw.versions?.[chosenVersion] ?? Object.values(raw.versions ?? {})[0];

    const versionsTime: Record<string, string> = {};
    if (raw.time) {
      for (const [v, t] of Object.entries(raw.time)) {
        if (v !== 'created' && v !== 'modified') {
          versionsTime[v] = t;
        }
      }
    }

    const publishedAt =
      (raw.time && raw.time[chosenVersion]) ??
      (raw.time && raw.time['modified']) ??
      new Date().toISOString();

    const rawRepo = versionObj?.repository ?? raw.repository;
    const normalizedRepo =
      typeof rawRepo === 'string'
        ? { url: rawRepo }
        : rawRepo && typeof rawRepo === 'object'
          ? { type: rawRepo.type, url: rawRepo.url, directory: rawRepo.directory }
          : undefined;

    const hasProvenance = Boolean(
      versionObj?.dist?.attestations?.provenance || (versionObj?.dist?.signatures && versionObj.dist.signatures.length > 0),
    );

    const isDeprecated = Boolean(versionObj?.deprecated);
    const deprecationReason =
      typeof versionObj?.deprecated === 'string'
        ? versionObj.deprecated
        : isDeprecated
          ? 'Marked as deprecated by author'
          : undefined;

    const result: PackageMetadata = {
      name: raw.name || packageName,
      version: chosenVersion,
      latestVersion,
      description: versionObj?.description ?? raw.description,
      license: versionObj?.license ?? raw.license,
      publishedAt,
      releaseCount: Object.keys(raw.versions ?? {}).length,
      isDeprecated,
      deprecationReason,
      engines: versionObj?.engines,
      peerDependencies: versionObj?.peerDependencies,
      rawRepository: normalizedRepo,
      hasProvenance,
      versionsTime,
    };

    await this.cache.set(cacheKey, result, this.cacheTtlMs);
    return result;
  }
}
