import type { ContextualAdvisory } from '../../core/types.js';
import type { AdvisoryProvider, CacheStore, RequestOptions } from '../types.js';
import type { ResilientHttpClient } from '../http/client.js';

interface OsvApiResponse {
  vulns?: Array<{
    id: string;
    summary?: string;
    details?: string;
    database_specific?: {
      severity?: string;
    };
  }>;
}

export class DefaultAdvisoryProvider implements AdvisoryProvider {
  constructor(
    private readonly httpClient: ResilientHttpClient,
    private readonly cache: CacheStore,
    private readonly cacheTtlMs = 2 * 60 * 60 * 1000, // 2 hours
  ) {}

  async getAdvisories(
    packageName: string,
    version: string,
    options: RequestOptions = {},
  ): Promise<readonly ContextualAdvisory[]> {
    const cacheKey = `adv:osv:${packageName}@${version}`;

    if (!options.forceRefresh) {
      const cached = await this.cache.get<ContextualAdvisory[]>(cacheKey);
      if (cached) return cached;
    }

    // OSV provides open package vulnerability data
    const url = `https://api.osv.dev/v1/query?package.name=${encodeURIComponent(packageName)}&package.ecosystem=npm&version=${encodeURIComponent(version)}`;

    try {
      const data = await this.httpClient.getJson<OsvApiResponse>(url, {
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      });

      const list: ContextualAdvisory[] = (data.vulns ?? []).map(v => {
        const rawSev = v.database_specific?.severity?.toLowerCase();
        let severity: 'low' | 'moderate' | 'high' | 'critical' = 'moderate';
        if (rawSev === 'low') severity = 'low';
        else if (rawSev === 'high') severity = 'high';
        else if (rawSev === 'critical') severity = 'critical';

        return {
          advisoryId: v.id,
          title: v.summary ?? v.id,
          severity,
          url: `https://osv.dev/vulnerability/${v.id}`,
        };
      });

      await this.cache.set(cacheKey, list, this.cacheTtlMs);
      return list;
    } catch {
      // If advisory query fails, return empty list (advisories are contextual only)
      return [];
    }
  }
}
