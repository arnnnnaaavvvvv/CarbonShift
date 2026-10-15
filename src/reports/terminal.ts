import pc from 'picocolors';
import type { DependencyHealthResult, MaintenanceRisk, Report } from '../core/types.js';

function getRiskBadge(risk: MaintenanceRisk): string {
  switch (risk) {
    case 'critical':
      return pc.bgRed(pc.white(pc.bold(' CRITICAL ')));
    case 'high':
      return pc.bgYellow(pc.black(pc.bold(' HIGH ')));
    case 'medium':
      return pc.yellow(pc.bold('MEDIUM'));
    case 'low':
      return pc.green(pc.bold('LOW'));
    case 'unknown':
      return pc.dim('UNKNOWN');
  }
}

function getScoreText(score: number | null): string {
  if (score === null) return pc.dim('N/A');
  if (score >= 80) return pc.green(String(score));
  if (score >= 50) return pc.yellow(String(score));
  if (score >= 25) return pc.yellow(String(score));
  return pc.red(String(score));
}

export function formatTerminalReport(
  report: Report,
  options: { verbose?: boolean | undefined } = {},
): string {
  const lines: string[] = [];

  // Title & Header
  lines.push('');
  lines.push(pc.bold(pc.cyan('DepPulse')) + ' ' + pc.dim('v0.1.0 – Dependency Health & Maintenance Intelligence'));
  lines.push(pc.dim('─'.repeat(70)));

  // Manifest info
  lines.push(
    `Manifest: ${pc.bold(report.manifestPath)} ${
      report.lockfilePath ? pc.dim(`(${report.lockfileFormat}, coverage: ${report.coverage})`) : pc.yellow('(no lockfile)')
    }`,
  );
  lines.push(
    `Scanned: ${pc.bold(String(report.scannedDependenciesCount))} dependencies (${report.directCount} direct, ${report.transitiveCount} transitive, ${report.skippedCount} skipped)`,
  );
  lines.push('');

  // Summary Metrics Bar
  const s = report.summary;
  const summaryBadges = [
    s.criticalRisk > 0 ? pc.red(`Critical: ${s.criticalRisk}`) : pc.dim(`Critical: 0`),
    s.highRisk > 0 ? pc.yellow(`High: ${s.highRisk}`) : pc.dim(`High: 0`),
    s.mediumRisk > 0 ? pc.yellow(`Medium: ${s.mediumRisk}`) : pc.dim(`Medium: 0`),
    pc.green(`Low (Healthy): ${s.lowRisk}`),
    s.unknownRisk > 0 ? pc.dim(`Unknown: ${s.unknownRisk}`) : null,
  ]
    .filter(Boolean)
    .join(pc.dim(' | '));

  lines.push(`Health Overview: ${summaryBadges}`);
  if (s.averageScore !== null) {
    lines.push(`Average Health Score: ${getScoreText(s.averageScore)}/100`);
  }
  lines.push(pc.dim('─'.repeat(70)));

  // Filter items to show:
  // If verbose: all. Otherwise: critical, high, medium, and unknown
  const itemsToShow = options.verbose
    ? report.results
    : report.results.filter(r => r.maintenanceRisk !== 'low');

  if (itemsToShow.length > 0) {
    lines.push('');
    lines.push(pc.bold('Actionable Maintenance Alerts:'));
    lines.push('');

    for (const item of itemsToShow) {
      const dep = item.dependency;
      const badge = getRiskBadge(item.maintenanceRisk);
      const scoreStr = getScoreText(item.score);
      const directTag = dep.isDirect ? pc.cyan('[direct]') : pc.dim('[transitive]');

      lines.push(`  ${badge}  ${pc.bold(dep.id)} ${directTag} Score: ${scoreStr}`);

      // Print primary explanation from evidence
      const significantEvidence = item.evidence.filter(
        e => e.contribution < 0 || e.isFatalCap || e.signal === 'advisory_context',
      );

      for (const ev of significantEvidence) {
        if (ev.isFatalCap) {
          lines.push(`     ${pc.red('✖')} ${ev.explanation}`);
        } else if (ev.contribution < 0) {
          lines.push(`     ${pc.yellow('⚠')} ${ev.explanation} (${ev.contribution})`);
        } else if (ev.signal === 'advisory_context') {
          lines.push(`     ${pc.dim('ℹ Context: ' + ev.explanation)}`);
        }
      }
      lines.push('');
    }
  } else {
    lines.push('');
    lines.push(pc.green('✔ No critical, high, or medium maintenance risks found. All scanned packages are healthy.'));
    lines.push('');
  }

  // Policy Outcome
  lines.push(pc.dim('─'.repeat(70)));
  if (report.policyResult.isPassed) {
    lines.push(pc.bold(pc.green('✔ POLICY PASSED: All dependencies satisfy configured health thresholds.')));
  } else {
    lines.push(pc.bold(pc.red(`✖ POLICY FAILED: Found ${report.policyResult.violations.length} policy violation(s):`)));
    for (const v of report.policyResult.violations) {
      lines.push(`   - ${pc.red(v.message)} ${pc.dim(`(Rule: ${v.rule})`)}`);
    }
  }

  if (report.policyResult.allowedExceptions.length > 0) {
    lines.push('');
    lines.push(pc.dim(`Permitted Exceptions (${report.policyResult.allowedExceptions.length}):`));
    for (const ex of report.policyResult.allowedExceptions) {
      lines.push(pc.dim(`   • ${ex}`));
    }
  }

  lines.push('');
  return lines.join('\n');
}

export function formatSinglePackageTerminal(result: DependencyHealthResult): string {
  const lines: string[] = [];
  const dep = result.dependency;

  lines.push('');
  lines.push(pc.bold(pc.cyan('DepPulse Package Analysis: ') + pc.white(dep.id)));
  lines.push(pc.dim('─'.repeat(60)));
  lines.push(`Maintenance Risk : ${getRiskBadge(result.maintenanceRisk)}`);
  lines.push(`Health Score     : ${getScoreText(result.score)} / 100`);
  lines.push(`Confidence       : ${(result.confidence * 100).toFixed(0)}%`);
  lines.push(`Lifecycle Status : ${result.isMatureStable ? pc.green('Mature-Stable') : pc.cyan('Active/Emerging')}`);
  lines.push('');
  lines.push(pc.bold('Evidence Audit Trail:'));

  for (const ev of result.evidence) {
    const symbol = ev.isFatalCap
      ? pc.red('✖')
      : ev.contribution > 0
        ? pc.green('✔')
        : ev.contribution < 0
          ? pc.yellow('⚠')
          : pc.dim('•');

    const delta = ev.contribution !== 0 ? ` (${ev.contribution > 0 ? '+' : ''}${ev.contribution})` : '';
    lines.push(`  ${symbol} [${ev.signal}] ${ev.explanation}${delta}`);
  }

  lines.push('');
  return lines.join('\n');
}
