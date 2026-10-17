import { promises as fs } from 'node:fs';
import path from 'node:path';
import { DepPulseEngine } from '../../core/engine.js';
import { parseConfig, getDefaultConfig } from '../../core/config.js';
import type { DepPulseConfig } from '../../core/config.js';
import { formatTerminalReport } from '../../reports/terminal.js';
import { formatJsonReport } from '../../reports/json.js';
import { formatMarkdownReport } from '../../reports/markdown.js';
import { PolicyViolationError, UsageError } from '../../core/errors.js';
import type { MaintenanceRisk } from '../../core/types.js';

export interface ScanCliOptions {
  format?: 'terminal' | 'json' | 'markdown' | undefined;
  failOn?: string | undefined;
  noCache?: boolean | undefined;
  output?: string | undefined;
  config?: string | undefined;
  verbose?: boolean | undefined;
}

export async function handleScanCommand(
  targetPath = '.',
  options: ScanCliOptions = {},
): Promise<number> {
  const format = options.format ?? 'terminal';
  if (format !== 'terminal' && format !== 'json' && format !== 'markdown') {
    throw new UsageError(`Invalid format '${options.format}'. Allowed: terminal, json, markdown`);
  }

  if (options.config && options.config.includes('\0')) {
    throw new UsageError('Invalid config path: contains null byte');
  }
  if (options.output && options.output.includes('\0')) {
    throw new UsageError('Invalid output path: contains null byte');
  }

  // Load custom config if specified, or check default deppulse.config.json
  let config: DepPulseConfig = getDefaultConfig();
  if (options.config) {
    const configPath = path.resolve(process.cwd(), options.config);
    try {
      const rawConfig = await fs.readFile(configPath, 'utf-8');
      config = parseConfig(JSON.parse(rawConfig));
    } catch (err) {
      throw new UsageError(
        `Failed to load specified config file at '${options.config}': ${(err as Error).message}`,
        'Verify the path and ensure valid JSON syntax matching the schema in docs/configuration.md',
      );
    }
  } else {
    const defaultConfigPath = path.resolve(targetPath, 'deppulse.config.json');
    try {
      const rawConfig = await fs.readFile(defaultConfigPath, 'utf-8');
      config = parseConfig(JSON.parse(rawConfig));
    } catch {
      // If default config doesn't exist, use defaults
    }
  }

  // Override failOn if flag passed
  if (options.failOn) {
    const risks = options.failOn.split(',').map(r => r.trim().toLowerCase()) as MaintenanceRisk[];
    const validRisks = new Set(['low', 'medium', 'high', 'critical', 'unknown']);
    for (const r of risks) {
      if (!validRisks.has(r)) {
        throw new UsageError(`Invalid --fail-on risk level '${r}'. Allowed: low, medium, high, critical, unknown`);
      }
    }
    config = {
      ...config,
      policy: {
        ...config.policy,
        failOnRisk: risks,
      },
    };
  }

  const engine = new DepPulseEngine(config);
  const report = await engine.scan(targetPath, {
    noCache: options.noCache,
  });

  let formatted = '';
  switch (format) {
    case 'json':
      formatted = formatJsonReport(report);
      break;
    case 'markdown':
      formatted = formatMarkdownReport(report);
      break;
    case 'terminal':
    default:
      formatted = formatTerminalReport(report, { verbose: options.verbose });
      break;
  }

  if (options.output) {
    const resolvedOutput = path.resolve(process.cwd(), options.output);
    await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
    await fs.writeFile(resolvedOutput, formatted, 'utf-8');
  } else {
    // eslint-disable-next-line no-console
    console.log(formatted);
  }

  if (!report.policyResult.isPassed) {
    throw new PolicyViolationError(
      `Policy violations found: ${report.policyResult.violations.length} issue(s)`,
      report.policyResult.violations.length,
      'Review flagged dependencies or update policy in deppulse.config.json',
      { violations: report.policyResult.violations },
    );
  }

  return 0;
}
