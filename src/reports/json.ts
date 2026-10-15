import type { Report } from '../core/types.js';

export function formatJsonReport(report: Report): string {
  // Serializes complete report with schemaVersion 1.0.0
  return JSON.stringify(report, null, 2);
}
