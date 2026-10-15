import type { RepoMetadata } from '../../core/types.js';
import type { CacheStore, RepoProvider, RequestOptions } from '../types.js';
import type { ResilientHttpClient } from '../http/client.js';
import { parseGitHubRepoUrl, verifyRepoIdentity } from '../../analysis/repo-verifier.js';

interface RawGitHubRepoResponse {
  archived?: boolean;
  fork?: boolean;
  pushed_at?: string;
  default_branch?: string;
  stargazers_count?: number;
  open_issues_count?: number;
  license?: { spdx_id?: string };
}

export class DefaultGitHubProvider implements RepoProvider {
  constructor(
    private readonly httpClient: ResilientHttpClient,
    private readonly cache: CacheStore,
    private readonly token?: string | undefined,
    private readonly cacheTtlMs = 6 * 60 * 60 * 1000, // 6 hours
  ) {
    this.token = token ?? process.env['GITHUB_TOKEN'] ?? process.env['GH_TOKEN'];
  }

  async getRepoMetadata(
    rawRepoUrl: string | undefined,
    expectedPackageName: string,
    options: RequestOptions = {},
  ): Promise<RepoMetadata> {
    const parsedRepo = parseGitHubRepoUrl(rawRepoUrl);

    if (!parsedRepo) {
      return {
        owner: '',
        repo: '',
        associationStatus: 'missing',
        isArchived: false,
        isFork: false,
        defaultBranch: 'main',
        stars: 0,
        openIssuesCount: 0,
        unverifiedReason: 'Package does not declare a public GitHub repository URL.',
      };
    }

    const { owner, repo } = parsedRepo;
    const cacheKey = `gh:repo:${owner.toLowerCase()}/${repo.toLowerCase()}`;

    if (!options.forceRefresh) {
      const cached = await this.cache.get<RepoMetadata>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const verification = verifyRepoIdentity(expectedPackageName, owner, repo, false);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

    try {
      const data = await this.httpClient.getJson<RawGitHubRepoResponse>(url, {
        headers,
        signal: options.signal,
        timeoutMs: options.timeoutMs,
      });

      const result: RepoMetadata = {
        owner,
        repo,
        associationStatus: verification.associationStatus,
        unverifiedReason: verification.unverifiedReason,
        isArchived: Boolean(data.archived),
        isFork: Boolean(data.fork),
        defaultBranch: data.default_branch ?? 'main',
        stars: data.stargazers_count ?? 0,
        openIssuesCount: data.open_issues_count ?? 0,
        lastCommitAt: data.pushed_at,
        licenseSpdx: data.license?.spdx_id,
      };

      await this.cache.set(cacheKey, result, this.cacheTtlMs);
      return result;
    } catch {
      // If 404, rate limited, or private repo, treat as unavailable repo
      const fallback: RepoMetadata = {
        owner,
        repo,
        associationStatus: 'unverified',
        isArchived: false,
        isFork: false,
        defaultBranch: 'main',
        stars: 0,
        openIssuesCount: 0,
        unverifiedReason: `Unable to access GitHub repository ${owner}/${repo} (may be private or deleted).`,
      };
      return fallback;
    }
  }
}
