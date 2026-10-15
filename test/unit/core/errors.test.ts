import { describe, it, expect } from 'vitest';
import {
  PolicyViolationError,
  AnalysisError,
  DiscoveryError,
  LockfileParseError,
  ProviderNetworkError,
  SSRFProtectionError,
  RateLimitExceededError,
  UsageError,
} from '../../../src/core/errors.js';

describe('Core Error Hierarchy', () => {
  it('correctly maps PolicyViolationError to exit code 1', () => {
    const error = new PolicyViolationError('Found 3 high risk dependencies', 3);
    expect(error.exitCode).toBe(1);
    expect(error.category).toBe('POLICY_VIOLATION');
    expect(error.violationCount).toBe(3);
    expect(error.recoveryHint).toBeDefined();
    expect(error.name).toBe('PolicyViolationError');
  });

  it('correctly maps AnalysisError and subclasses to exit code 2', () => {
    const analysisErr = new AnalysisError('Analysis failed');
    expect(analysisErr.exitCode).toBe(2);
    expect(analysisErr.category).toBe('ANALYSIS_ERROR');

    const discoveryErr = new DiscoveryError('package.json missing');
    expect(discoveryErr.exitCode).toBe(2);
    expect(discoveryErr.category).toBe('DISCOVERY_ERROR');

    const lockfileErr = new LockfileParseError('Corrupt lockfile syntax');
    expect(lockfileErr.exitCode).toBe(2);
    expect(lockfileErr.category).toBe('LOCKFILE_PARSE_ERROR');

    const networkErr = new ProviderNetworkError('Failed to fetch packument');
    expect(networkErr.exitCode).toBe(2);
    expect(networkErr.category).toBe('PROVIDER_NETWORK_ERROR');

    const ssrfErr = new SSRFProtectionError('Blocked connection to 127.0.0.1');
    expect(ssrfErr.exitCode).toBe(2);
    expect(ssrfErr.category).toBe('SSRF_PROTECTION_ERROR');

    const rateLimitErr = new RateLimitExceededError('GitHub rate limit hit');
    expect(rateLimitErr.exitCode).toBe(2);
    expect(rateLimitErr.category).toBe('RATE_LIMIT_EXCEEDED');

    const usageErr = new UsageError('Missing required argument');
    expect(usageErr.exitCode).toBe(2);
    expect(usageErr.category).toBe('USAGE_ERROR');
  });

  it('serializes to JSON cleanly with metadata', () => {
    const err = new LockfileParseError('Unexpected EOF', 'Re-generate package-lock.json', {
      file: 'package-lock.json',
      line: 42,
    });
    const json = err.toJSON();
    expect(json.name).toBe('LockfileParseError');
    expect(json.category).toBe('LOCKFILE_PARSE_ERROR');
    expect(json.exitCode).toBe(2);
    expect(json.message).toBe('Unexpected EOF');
    expect(json.recoveryHint).toBe('Re-generate package-lock.json');
    expect(json.details).toEqual({ file: 'package-lock.json', line: 42 });
    expect(json.timestamp).toBeDefined();
  });
});
