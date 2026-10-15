/**
 * DepPulse Typed Errors
 * Distinguishes policy violations (exit 1) from analysis and runtime errors (exit 2).
 */

export type ExitCode = 0 | 1 | 2;

export abstract class DepPulseError extends Error {
  abstract readonly exitCode: ExitCode;
  abstract readonly category: string;
  readonly timestamp: string;

  constructor(
    message: string,
    public readonly recoveryHint?: string,
    public readonly details?: Readonly<Record<string, unknown>>,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = this.constructor.name;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      category: this.category,
      message: this.message,
      exitCode: this.exitCode,
      recoveryHint: this.recoveryHint,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * PolicyViolationError (Exit Code 1)
 * Triggered when a dependency violates configured risk thresholds (e.g. --fail-on high).
 */
export class PolicyViolationError extends DepPulseError {
  readonly exitCode = 1;
  readonly category = 'POLICY_VIOLATION';

  constructor(
    message: string,
    public readonly violationCount: number,
    recoveryHint = 'Review flagged dependencies in the report or add an exception with justification in deppulse.config.json',
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message, recoveryHint, details);
  }
}

/**
 * AnalysisError (Exit Code 2)
 * Base class for all discovery, network, parsing, and execution failures.
 */
export class AnalysisError extends DepPulseError {
  readonly exitCode = 2;
  readonly category: string = 'ANALYSIS_ERROR';

  constructor(
    message: string,
    recoveryHint = 'Check the error message, verify input paths, and re-run with --verbose for detailed trace.',
    details?: Readonly<Record<string, unknown>>,
    options?: { cause?: unknown },
  ) {
    super(message, recoveryHint, details, options);
  }
}

export class DiscoveryError extends AnalysisError {
  override readonly category = 'DISCOVERY_ERROR';
}

export class LockfileParseError extends AnalysisError {
  override readonly category = 'LOCKFILE_PARSE_ERROR';
}

export class ConfigValidationError extends AnalysisError {
  override readonly category = 'CONFIG_VALIDATION_ERROR';
}

export class ProviderNetworkError extends AnalysisError {
  override readonly category = 'PROVIDER_NETWORK_ERROR';
}

export class SSRFProtectionError extends AnalysisError {
  override readonly category = 'SSRF_PROTECTION_ERROR';
}

export class RateLimitExceededError extends AnalysisError {
  override readonly category = 'RATE_LIMIT_EXCEEDED';
}

export class UsageError extends AnalysisError {
  override readonly category = 'USAGE_ERROR';
}
