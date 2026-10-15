import pc from 'picocolors';
import { DepPulseEngine } from '../../core/engine.js';
import { getDefaultConfig } from '../../core/config.js';
import { UsageError } from '../../core/errors.js';

export interface CompareCliOptions {
  from?: string | undefined;
  to?: string | undefined;
  format?: 'terminal' | 'json' | undefined;
}

export async function handleCompareCommand(
  pkgName: string,
  options: CompareCliOptions = {},
): Promise<number> {
  if (!pkgName) {
    throw new UsageError('Missing package argument. Usage: deppulse compare <pkg> --from <v1> --to <v2>');
  }
  if (!options.from) {
    throw new UsageError('Missing --from flag. Specify starting version.');
  }
  if (!options.to) {
    throw new UsageError('Missing --to flag. Specify target version.');
  }

  const engine = new DepPulseEngine(getDefaultConfig());
  const assessment = await engine.compare(pkgName, options.from, options.to);

  if (options.format === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(assessment, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log('');
    // eslint-disable-next-line no-console
    console.log(pc.bold(pc.cyan('DepPulse Upgrade Comparison: ') + `${pkgName} (${options.from} → ${options.to})`));
    // eslint-disable-next-line no-console
    console.log(pc.dim('─'.repeat(60)));
    // eslint-disable-next-line no-console
    console.log(`Update Type     : ${pc.bold(assessment.updateType.toUpperCase())}`);
    // eslint-disable-next-line no-console
    console.log(`Current Risk    : ${assessment.currentRisk.toUpperCase()}`);
    // eslint-disable-next-line no-console
    console.log(`Target Risk     : ${assessment.targetRisk.toUpperCase()}`);
    // eslint-disable-next-line no-console
    console.log(
      `Recommendation  : ${
        assessment.recommendation === 'upgrade'
          ? pc.green(pc.bold('UPGRADE'))
          : assessment.recommendation === 'hold'
            ? pc.red(pc.bold('HOLD'))
            : pc.yellow(pc.bold(assessment.recommendation.toUpperCase()))
      }`,
    );
    // eslint-disable-next-line no-console
    console.log(`Rationale       : ${assessment.rationale}`);
    // eslint-disable-next-line no-console
    console.log('');
  }

  return 0;
}
