/**
 * DepPulse Configuration Schema & Validation (Zod)
 * Strict, versioned schema with safe defaults and explicit exception rationale.
 */

import { z } from 'zod';
import { ConfigValidationError } from './errors.js';

export const ExceptionRuleSchema = z.object({
  name: z.string().min(1, 'Package name in allowList cannot be empty'),
  versionRange: z.string().default('*'),
  reason: z.string().min(5, 'Reason for exception must be documented with at least 5 characters'),
  expiresAt: z.string().datetime({ message: 'expiresAt must be a valid ISO-8601 datetime' }).optional(),
});

export const ScoringConfigSchema = z.object({
  minConfidenceThreshold: z
    .number()
    .min(0, 'minConfidenceThreshold must be >= 0')
    .max(1, 'minConfidenceThreshold must be <= 1')
    .default(0.35),
  maturityThresholdYears: z
    .number()
    .min(1, 'maturityThresholdYears must be >= 1')
    .default(4),
});

export const PolicyConfigSchema = z.object({
  failOnRisk: z
    .array(z.enum(['low', 'medium', 'high', 'critical', 'unknown']))
    .default(['critical']),
  maxHighRiskAllowed: z.number().int().min(0).default(0),
  minScore: z.number().min(0).max(100).optional(),
  treatUnknownAsFailure: z.boolean().default(false),
  allowList: z.array(ExceptionRuleSchema).default([]),
});

export const NetworkConfigSchema = z.object({
  concurrency: z.number().int().min(1).max(32).default(8),
  timeoutMs: z.number().int().min(1000).max(30000).default(8000),
  maxRetries: z.number().int().min(0).max(5).default(3),
  allowedRegistries: z
    .array(z.string().url('Registry must be a valid URL'))
    .default(['https://registry.npmjs.org']),
});

export const CacheConfigSchema = z.object({
  enabled: z.boolean().default(true),
  dir: z.string().optional(),
  ttlHours: z.number().min(0).default(24),
});

export const ConfigSchema = z.object({
  version: z.literal(1, {
    errorMap: () => ({ message: 'Unsupported configuration version. Currently only version 1 is supported.' }),
  }),
  scoring: ScoringConfigSchema.default({}),
  policy: PolicyConfigSchema.default({}),
  network: NetworkConfigSchema.default({}),
  cache: CacheConfigSchema.default({}),
});

export type DepPulseConfig = z.infer<typeof ConfigSchema>;
export type ExceptionRule = z.infer<typeof ExceptionRuleSchema>;

/**
 * Returns a fully populated configuration with default values.
 */
export function getDefaultConfig(): DepPulseConfig {
  return ConfigSchema.parse({ version: 1 });
}

/**
 * Validates and parses raw configuration data against the Zod schema.
 * Throws a typed ConfigValidationError if invalid.
 */
export function parseConfig(raw: unknown): DepPulseConfig {
  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    const errorMessages = result.error.errors
      .map(err => `  - ${err.path.join('.') || 'root'}: ${err.message}`)
      .join('\n');
    throw new ConfigValidationError(
      `Invalid DepPulse configuration:\n${errorMessages}`,
      'Check deppulse.config.json against the schema reference in docs/configuration.md',
      { issues: result.error.issues },
    );
  }
  return result.data;
}
