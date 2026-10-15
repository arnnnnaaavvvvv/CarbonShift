import { describe, it, expect } from 'vitest';
import { getDefaultConfig, parseConfig } from '../../../src/core/config.js';
import { ConfigValidationError } from '../../../src/core/errors.js';

describe('Core Config Schema', () => {
  it('returns valid default configuration', () => {
    const config = getDefaultConfig();
    expect(config.version).toBe(1);
    expect(config.scoring.minConfidenceThreshold).toBe(0.35);
    expect(config.scoring.maturityThresholdYears).toBe(4);
    expect(config.policy.failOnRisk).toEqual(['critical']);
    expect(config.policy.maxHighRiskAllowed).toBe(0);
    expect(config.policy.allowList).toEqual([]);
    expect(config.network.concurrency).toBe(8);
    expect(config.network.timeoutMs).toBe(8000);
    expect(config.cache.enabled).toBe(true);
    expect(config.cache.ttlHours).toBe(24);
  });

  it('accepts and merges custom valid configuration', () => {
    const custom = {
      version: 1,
      policy: {
        failOnRisk: ['high', 'critical'],
        maxHighRiskAllowed: 2,
        allowList: [
          {
            name: 'legacy-pkg',
            versionRange: '^1.0.0',
            reason: 'Migration scheduled for Q3',
          },
        ],
      },
      network: {
        concurrency: 4,
      },
    };

    const config = parseConfig(custom);
    expect(config.policy.failOnRisk).toEqual(['high', 'critical']);
    expect(config.policy.maxHighRiskAllowed).toBe(2);
    expect(config.policy.allowList).toHaveLength(1);
    expect(config.policy.allowList[0]?.name).toBe('legacy-pkg');
    expect(config.network.concurrency).toBe(4);
    // Preserves defaults for omitted fields
    expect(config.network.timeoutMs).toBe(8000);
    expect(config.scoring.minConfidenceThreshold).toBe(0.35);
  });

  it('throws ConfigValidationError on invalid version', () => {
    expect(() => parseConfig({ version: 2 })).toThrow(ConfigValidationError);
    try {
      parseConfig({ version: 2 });
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigValidationError);
      expect((err as ConfigValidationError).exitCode).toBe(2);
      expect((err as ConfigValidationError).recoveryHint).toContain('deppulse.config.json');
    }
  });

  it('throws ConfigValidationError when exception reason is too short', () => {
    const invalid = {
      version: 1,
      policy: {
        allowList: [
          {
            name: 'pkg',
            reason: 'no', // Less than 5 characters
          },
        ],
      },
    };
    expect(() => parseConfig(invalid)).toThrow(ConfigValidationError);
  });

  it('throws ConfigValidationError on out-of-range thresholds', () => {
    expect(() =>
      parseConfig({
        version: 1,
        scoring: { minConfidenceThreshold: 1.5 },
      }),
    ).toThrow(ConfigValidationError);

    expect(() =>
      parseConfig({
        version: 1,
        network: { concurrency: 0 },
      }),
    ).toThrow(ConfigValidationError);
  });
});
