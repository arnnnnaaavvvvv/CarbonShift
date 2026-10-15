import type {
  ContextualAdvisory,
  DependencyHealthResult,
  DependencyRecord,
  MaintenanceRisk,
  PackageMetadata,
  Report,
  ReportSummary,
  UpgradeAssessment,
} from './types.js';
import type { DepPulseConfig } from './config.js';
import { getDefaultConfig } from './config.js';
import { discoverDependencies } from '../discovery/index.js';
import { DiskCacheStore } from '../cache/disk-store.js';
import { ResilientHttpClient } from '../providers/http/client.js';
import { DefaultNpmRegistryProvider } from '../providers/npm/registry.js';
import { DefaultGitHubProvider } from '../providers/github/client.js';
import { DefaultAdvisoryProvider } from '../providers/advisory/contextual.js';
import type { AdvisoryProvider, CacheStore, NpmRegistryProvider, RepoProvider } from '../providers/types.js';
import { scoreDependencyHealth } from '../scoring/engine.js';
import { evaluateUpgradeRisk } from '../analysis/upgrade.js';
import { evaluatePolicy } from '../policy/evaluator.js';

export interface EngineDependencies {
  npmProvider?: NpmRegistryProvider | undefined;
  repoProvider?: RepoProvider | undefined;
  advisoryProvider?: AdvisoryProvider | undefined;
  cacheStore?: CacheStore | undefined;
}

export class DepPulseEngine {
  private readonly config: DepPulseConfig;
  private readonly npmProvider: NpmRegistryProvider;
  private readonly repoProvider: RepoProvider;
  private readonly advisoryProvider: AdvisoryProvider;
  private readonly cacheStore: CacheStore;

  constructor(config?: DepPulseConfig | undefined, deps: EngineDependencies = {}) {
    this.config = config ?? getDefaultConfig();

    this.cacheStore =
      deps.cacheStore ??
      new DiskCacheStore({
        dir: this.config.cache.dir,
        enabled: this.config.cache.enabled,
      });

    const httpClient = new ResilientHttpClient({
      concurrency: this.config.network.concurrency,
      timeoutMs: this.config.network.timeoutMs,
      maxRetries: this.config.network.maxRetries,
      allowedRegistries: this.config.network.allowedRegistries,
    });

    this.npmProvider = deps.npmProvider ?? new DefaultNpmRegistryProvider(httpClient, this.cacheStore);
    this.repoProvider = deps.repoProvider ?? new DefaultGitHubProvider(httpClient, this.cacheStore);
    this.advisoryProvider = deps.advisoryProvider ?? new DefaultAdvisoryProvider(httpClient, this.cacheStore);
  }

  async scan(projectPath: string, scanOverrides: { noCache?: boolean | undefined } = {}): Promise<Report> {
    const discovery = await discoverDependencies(projectPath);

    const results: DependencyHealthResult[] = [];
    const requestOptions = {
      forceRefresh: Boolean(scanOverrides.noCache),
    };

    // Analyze dependencies with bounded parallel execution
    for (const dep of discovery.dependencies) {
      try {
        const pkgMeta = await this.npmProvider.getPackageMeta(dep.name, dep.resolvedVersion, requestOptions);
        const repoMeta = await this.repoProvider.getRepoMetadata(
          pkgMeta.rawRepository?.url,
          dep.name,
          requestOptions,
        );
        let advisories: readonly ContextualAdvisory[] = [];
        try {
          advisories = await this.advisoryProvider.getAdvisories(dep.name, dep.resolvedVersion, requestOptions);
        } catch {
          // Advisories are non-blocking
        }

        const health = scoreDependencyHealth(dep, pkgMeta, repoMeta, advisories, {
          minConfidenceThreshold: this.config.scoring.minConfidenceThreshold,
          maturityThresholdYears: this.config.scoring.maturityThresholdYears,
        });

        results.push(health);
      } catch (err) {
        // Individual package fetch failure does not fail the entire scan (unless private/unavailable)
        const fallbackMeta: PackageMetadata = {
          name: dep.name,
          version: dep.resolvedVersion,
          latestVersion: dep.resolvedVersion,
          publishedAt: '',
          releaseCount: 0,
          isDeprecated: false,
          hasProvenance: false,
          versionsTime: {},
        };
        const fallbackRepo = {
          owner: '',
          repo: '',
          associationStatus: 'missing' as const,
          isArchived: false,
          isFork: false,
          defaultBranch: 'main',
          stars: 0,
          openIssuesCount: 0,
          unverifiedReason: `Upstream fetch failed: ${(err as Error).message}`,
        };

        const fallbackResult = scoreDependencyHealth(dep, fallbackMeta, fallbackRepo, [], {
          minConfidenceThreshold: this.config.scoring.minConfidenceThreshold,
        });
        results.push(fallbackResult);
      }
    }

    // Deterministic sorting: Critical -> High -> Medium -> Unknown -> Low, then by score asc, then name
    const riskRank: Record<MaintenanceRisk, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      unknown: 3,
      low: 4,
    };

    results.sort((a, b) => {
      const rankDiff = riskRank[a.maintenanceRisk] - riskRank[b.maintenanceRisk];
      if (rankDiff !== 0) return rankDiff;

      const scoreA = a.score ?? -1;
      const scoreB = b.score ?? -1;
      if (scoreA !== scoreB) return scoreA - scoreB;

      return a.dependency.name.localeCompare(b.dependency.name);
    });

    // Compute summary
    let lowCount = 0;
    let medCount = 0;
    let highCount = 0;
    let critCount = 0;
    let unkCount = 0;
    let scoreSum = 0;
    let scoredCount = 0;

    for (const r of results) {
      switch (r.maintenanceRisk) {
        case 'low':
          lowCount++;
          break;
        case 'medium':
          medCount++;
          break;
        case 'high':
          highCount++;
          break;
        case 'critical':
          critCount++;
          break;
        case 'unknown':
          unkCount++;
          break;
      }
      if (r.score !== null) {
        scoreSum += r.score;
        scoredCount++;
      }
    }

    const summary: ReportSummary = {
      lowRisk: lowCount,
      mediumRisk: medCount,
      highRisk: highCount,
      criticalRisk: critCount,
      unknownRisk: unkCount,
      averageScore: scoredCount > 0 ? Math.round(scoreSum / scoredCount) : null,
    };

    const policyResult = evaluatePolicy(results, {
      failOnRisk: this.config.policy.failOnRisk,
      maxHighRiskAllowed: this.config.policy.maxHighRiskAllowed,
      allowList: this.config.policy.allowList,
      minScore: this.config.policy.minScore,
      treatUnknownAsFailure: this.config.policy.treatUnknownAsFailure,
    });

    return {
      schemaVersion: '1.0.0',
      manifestPath: discovery.manifestPath,
      lockfilePath: discovery.lockfilePath,
      lockfileFormat: discovery.lockfileFormat,
      coverage: discovery.coverage,
      scannedDependenciesCount: results.length,
      directCount: discovery.dependencies.filter(d => d.isDirect).length,
      transitiveCount: discovery.dependencies.filter(d => !d.isDirect).length,
      skippedCount: discovery.skipped.length,
      summary,
      results,
      policyResult,
      generatedAt: new Date().toISOString(),
    };
  }

  async analyze(packageName: string, version?: string): Promise<DependencyHealthResult> {
    const pkgMeta = await this.npmProvider.getPackageMeta(packageName, version);
    const resolvedVersion = version ?? pkgMeta.version;
    const repoMeta = await this.repoProvider.getRepoMetadata(pkgMeta.rawRepository?.url, packageName);
    let advisories: readonly ContextualAdvisory[] = [];
    try {
      advisories = await this.advisoryProvider.getAdvisories(packageName, resolvedVersion);
    } catch {
      // non-blocking
    }

    const dummyDep: DependencyRecord = {
      id: `${packageName}@${resolvedVersion}`,
      name: packageName,
      declaredRange: resolvedVersion,
      resolvedVersion,
      type: 'prod',
      source: 'npm',
      registryUrl: 'https://registry.npmjs.org',
      isDirect: true,
      dependents: [],
    };

    return scoreDependencyHealth(dummyDep, pkgMeta, repoMeta, advisories, {
      minConfidenceThreshold: this.config.scoring.minConfidenceThreshold,
      maturityThresholdYears: this.config.scoring.maturityThresholdYears,
    });
  }

  async compare(packageName: string, fromVersion: string, toVersion: string): Promise<UpgradeAssessment> {
    const currentHealth = await this.analyze(packageName, fromVersion);
    const targetMeta = await this.npmProvider.getPackageMeta(packageName, toVersion);
    const targetRepo = await this.repoProvider.getRepoMetadata(targetMeta.rawRepository?.url, packageName);
    const targetHealth = scoreDependencyHealth(
      {
        id: `${packageName}@${toVersion}`,
        name: packageName,
        declaredRange: toVersion,
        resolvedVersion: toVersion,
        type: 'prod',
        source: 'npm',
        registryUrl: 'https://registry.npmjs.org',
        isDirect: true,
        dependents: [],
      },
      targetMeta,
      targetRepo,
      [],
    );

    return evaluateUpgradeRisk(
      currentHealth.dependency,
      fromVersion,
      toVersion,
      targetMeta,
      currentHealth.maintenanceRisk,
      targetHealth.maintenanceRisk,
    );
  }
}
