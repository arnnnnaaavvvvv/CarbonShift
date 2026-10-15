/**
 * DepPulse Core Domain Types
 * Strict, read-only domain definitions for dependency health, maintenance risk, and upgrade intelligence.
 */

export type DependencyType = 'prod' | 'dev' | 'optional' | 'peer' | 'transitive';
export type DependencySource = 'npm' | 'workspace' | 'git' | 'file' | 'alias' | 'unknown';
export type MaintenanceRisk = 'low' | 'medium' | 'high' | 'critical' | 'unknown';

export interface DependencyRecord {
  readonly id: string;
  readonly name: string;
  readonly declaredRange: string;
  readonly resolvedVersion: string;
  readonly type: DependencyType;
  readonly source: DependencySource;
  readonly registryUrl: string;
  readonly isDirect: boolean;
  readonly dependents: readonly string[];
  readonly skipReason?: 'ignored_by_config' | 'private_workspace' | 'unsupported_source' | 'unresolved' | undefined;
}

export interface PackageMetadata {
  readonly name: string;
  readonly version: string;
  readonly latestVersion: string;
  readonly description?: string | undefined;
  readonly license?: string | undefined;
  readonly publishedAt: string; // ISO-8601
  readonly releaseCount: number;
  readonly isDeprecated: boolean;
  readonly deprecationReason?: string | undefined;
  readonly engines?: {
    readonly node?: string | undefined;
    readonly npm?: string | undefined;
  } | undefined;
  readonly peerDependencies?: Readonly<Record<string, string>> | undefined;
  readonly rawRepository?: {
    readonly type?: string | undefined;
    readonly url?: string | undefined;
    readonly directory?: string | undefined;
  } | undefined;
  readonly hasProvenance: boolean;
  readonly versionsTime: Readonly<Record<string, string>>;
}

export type RepoAssociationStatus = 'verified' | 'unverified' | 'divergent' | 'missing';

export interface RepoMetadata {
  readonly owner: string;
  readonly repo: string;
  readonly associationStatus: RepoAssociationStatus;
  readonly isArchived: boolean;
  readonly isFork: boolean;
  readonly defaultBranch: string;
  readonly stars: number;
  readonly openIssuesCount: number;
  readonly lastCommitAt?: string | undefined;
  readonly lastReleaseAt?: string | undefined;
  readonly licenseSpdx?: string | undefined;
  readonly unverifiedReason?: string | undefined;
}

export type EvidenceSignal =
  | 'deprecation'
  | 'archive_status'
  | 'release_recency'
  | 'release_cadence'
  | 'node_engine_compat'
  | 'repo_provenance'
  | 'mature_stability'
  | 'maintenance_commit_recency'
  | 'advisory_context'; // Context only, zero score impact

export interface HealthEvidence {
  readonly signal: EvidenceSignal;
  readonly observedValue: unknown;
  readonly source: 'npm' | 'github' | 'lockfile' | 'manifest' | 'advisory';
  readonly observedAt: string;
  readonly explanation: string;
  readonly contribution: number; // delta on score: -100 to +100
  readonly isFatalCap?: boolean | undefined;
  readonly fatalCapValue?: number | undefined;
}

export interface ContextualAdvisory {
  readonly advisoryId: string;
  readonly title: string;
  readonly severity: 'low' | 'moderate' | 'high' | 'critical';
  readonly url: string;
}

export interface DependencyHealthResult {
  readonly dependency: DependencyRecord;
  readonly score: number | null; // 0-100 or null if confidence is below threshold
  readonly maintenanceRisk: MaintenanceRisk;
  readonly confidence: number; // 0.0 to 1.0
  readonly isMatureStable: boolean;
  readonly evidence: readonly HealthEvidence[];
  readonly contextualAdvisories?: readonly ContextualAdvisory[] | undefined;
  readonly analyzedAt: string;
  readonly scoringVersion: string; // e.g. "1.0.0"
}

export interface UpgradeAssessment {
  readonly dependency: DependencyRecord;
  readonly currentVersion: string;
  readonly targetVersion: string;
  readonly updateType: 'patch' | 'minor' | 'major';
  readonly currentRisk: MaintenanceRisk;
  readonly targetRisk: MaintenanceRisk;
  readonly breakingEngineChanges: boolean;
  readonly recommendation: 'upgrade' | 'monitor' | 'hold' | 'replace';
  readonly rationale: string;
}

export interface PolicyRule {
  readonly failOnRisk: readonly MaintenanceRisk[];
  readonly maxHighRiskAllowed: number;
  readonly allowList: readonly {
    readonly name: string;
    readonly versionRange?: string | undefined;
    readonly reason: string;
    readonly expiresAt?: string | undefined; // ISO-8601
  }[];
  readonly minScore?: number | undefined;
  readonly treatUnknownAsFailure: boolean;
}

export interface PolicyViolation {
  readonly dependencyId: string;
  readonly rule: string;
  readonly message: string;
  readonly risk: MaintenanceRisk;
}

export interface PolicyEvaluationResult {
  readonly isPassed: boolean;
  readonly violations: readonly PolicyViolation[];
  readonly allowedExceptions: readonly string[];
}

export interface ReportSummary {
  readonly lowRisk: number;
  readonly mediumRisk: number;
  readonly highRisk: number;
  readonly criticalRisk: number;
  readonly unknownRisk: number;
  readonly averageScore: number | null;
}

export interface Report {
  readonly schemaVersion: '1.0.0';
  readonly manifestPath: string;
  readonly lockfilePath?: string | undefined;
  readonly lockfileFormat?:
    | 'npm-v1'
    | 'npm-v2'
    | 'npm-v3'
    | 'npm-shrinkwrap'
    | 'yarn-v1'
    | 'yarn-v2'
    | 'pnpm-v5'
    | 'pnpm-v6'
    | 'pnpm-v9'
    | 'unsupported'
    | undefined;
  readonly coverage: 'full' | 'partial' | 'direct-only';
  readonly scannedDependenciesCount: number;
  readonly directCount: number;
  readonly transitiveCount: number;
  readonly skippedCount: number;
  readonly summary: ReportSummary;
  readonly results: readonly DependencyHealthResult[];
  readonly upgradeAssessments?: readonly UpgradeAssessment[] | undefined;
  readonly policyResult: PolicyEvaluationResult;
  readonly generatedAt: string;
}
