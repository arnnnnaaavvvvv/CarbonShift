import { describe, it, expect } from 'vitest';
import { formatTerminalReport, formatSinglePackageTerminal } from '../../../src/reports/terminal.js';
import { formatJsonReport } from '../../../src/reports/json.js';
import { formatMarkdownReport } from '../../../src/reports/markdown.js';
import type { Report, DependencyHealthResult } from '../../../src/core/types.js';

// eslint-disable-next-line no-control-regex
const stripAnsi = (str: string) => str.replace(/\u001b\[[0-9;]*m/g, '');

describe('Report Formatters', () => {
  const dummyReport: Report = {
    schemaVersion: '1.0.0',
    manifestPath: 'package.json',
    lockfilePath: 'package-lock.json',
    lockfileFormat: 'npm-v3',
    coverage: 'full',
    scannedDependenciesCount: 2,
    directCount: 1,
    transitiveCount: 1,
    skippedCount: 0,
    summary: {
      lowRisk: 1,
      mediumRisk: 0,
      highRisk: 0,
      criticalRisk: 1,
      unknownRisk: 0,
      averageScore: 50,
    },
    results: [
      {
        dependency: {
          id: 'request@2.88.2',
          name: 'request',
          declaredRange: '^2.88.2',
          resolvedVersion: '2.88.2',
          type: 'prod',
          source: 'npm',
          registryUrl: 'https://registry.npmjs.org',
          isDirect: true,
          dependents: [],
        },
        score: 15,
        maintenanceRisk: 'critical',
        confidence: 0.95,
        isMatureStable: false,
        evidence: [
          {
            signal: 'deprecation',
            observedValue: { isDeprecated: true },
            source: 'npm',
            observedAt: '2026-01-01T00:00:00.000Z',
            explanation: 'Package is deprecated: request has been deprecated',
            contribution: -80,
            isFatalCap: true,
            fatalCapValue: 20,
          },
        ],
        analyzedAt: '2026-01-01T00:00:00.000Z',
        scoringVersion: '1.0.0',
      },
      {
        dependency: {
          id: 'lodash@4.17.21',
          name: 'lodash',
          declaredRange: '^4.17.21',
          resolvedVersion: '4.17.21',
          type: 'transitive',
          source: 'npm',
          registryUrl: 'https://registry.npmjs.org',
          isDirect: false,
          dependents: ['request'],
        },
        score: 85,
        maintenanceRisk: 'low',
        confidence: 0.9,
        isMatureStable: true,
        evidence: [],
        analyzedAt: '2026-01-01T00:00:00.000Z',
        scoringVersion: '1.0.0',
      },
    ],
    policyResult: {
      isPassed: false,
      violations: [
        {
          dependencyId: 'request@2.88.2',
          rule: "failOnRisk contains 'critical'",
          message: 'Dependency request@2.88.2 carries critical maintenance risk.',
          risk: 'critical',
        },
      ],
      allowedExceptions: [],
    },
    generatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('formats terminal output with clear severity highlights and summary', () => {
    const raw = formatTerminalReport(dummyReport);
    const output = stripAnsi(raw);
    expect(output).toContain('DepPulse');
    expect(output).toContain('Scanned: 2 dependencies');
    expect(output).toContain('Critical: 1');
    expect(output).toContain('request@2.88.2');
    expect(output).toContain('POLICY FAILED');
  });

  it('formats valid versioned JSON output', () => {
    const jsonStr = formatJsonReport(dummyReport);
    const parsed = JSON.parse(jsonStr) as Report;
    expect(parsed.schemaVersion).toBe('1.0.0');
    expect(parsed.scannedDependenciesCount).toBe(2);
    expect(parsed.policyResult.isPassed).toBe(false);
  });

  it('formats clean Markdown PR summary', () => {
    const md = formatMarkdownReport(dummyReport);
    expect(md).toContain('## ❌ DepPulse Dependency Health Report');
    expect(md).toContain('| 🔴 Critical Risk | 1 |');
    expect(md).toContain('`request@2.88.2`');
  });

  it('formats single package terminal view', () => {
    const single = dummyReport.results[0] as DependencyHealthResult;
    const raw = formatSinglePackageTerminal(single);
    const output = stripAnsi(raw);
    expect(output).toContain('DepPulse Package Analysis: request@2.88.2');
    expect(output).toContain('Evidence Audit Trail:');
    expect(output).toContain('[deprecation]');
  });
});
