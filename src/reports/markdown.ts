import type { Report } from '../core/types.js';

export function formatMarkdownReport(report: Report): string {
  const lines: string[] = [];

  const statusEmoji = report.policyResult.isPassed ? '✅' : '❌';
  lines.push(`## ${statusEmoji} DepPulse Dependency Health Report`);
  lines.push('');
  lines.push(`- **Scanned**: ${report.scannedDependenciesCount} packages (${report.directCount} direct, ${report.transitiveCount} transitive)`);
  lines.push(`- **Coverage**: ${report.coverage} (${report.lockfileFormat ?? 'no lockfile'})`);
  lines.push(`- **Scan Timestamp**: ${report.generatedAt}`);
  lines.push('');

  const s = report.summary;
  lines.push('| Metric | Count |');
  lines.push('| :--- | :--- |');
  lines.push(`| 🔴 Critical Risk | ${s.criticalRisk} |`);
  lines.push(`| 🟡 High Risk | ${s.highRisk} |`);
  lines.push(`| 🟠 Medium Risk | ${s.mediumRisk} |`);
  lines.push(`| 🟢 Low Risk (Healthy) | ${s.lowRisk} |`);
  lines.push(`| ⚪ Unknown | ${s.unknownRisk} |`);
  if (s.averageScore !== null) {
    lines.push(`| **Average Score** | **${s.averageScore} / 100** |`);
  }
  lines.push('');

  const flagged = report.results.filter(r => r.maintenanceRisk !== 'low');
  if (flagged.length > 0) {
    lines.push('### ⚠️ Actionable Maintenance Alerts');
    lines.push('');
    lines.push('| Dependency | Risk | Score | Primary Finding |');
    lines.push('| :--- | :--- | :--- | :--- |');

    for (const item of flagged) {
      const primaryIssue =
        item.evidence.find(e => e.isFatalCap || e.contribution < 0)?.explanation ?? 'Maintenance warning';
      lines.push(
        `| \`${item.dependency.id}\` | **${item.maintenanceRisk.toUpperCase()}** | ${item.score ?? 'N/A'} | ${primaryIssue} |`,
      );
    }
    lines.push('');
  }

  if (!report.policyResult.isPassed) {
    lines.push('### ❌ Policy Violations');
    for (const v of report.policyResult.violations) {
      lines.push(`- ${v.message} *(Rule: \`${v.rule}\`)*`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
