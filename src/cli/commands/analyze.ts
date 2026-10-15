import { DepPulseEngine } from '../../core/engine.js';
import { getDefaultConfig } from '../../core/config.js';
import { formatSinglePackageTerminal } from '../../reports/terminal.js';
import { UsageError } from '../../core/errors.js';

export interface AnalyzeCliOptions {
  format?: 'terminal' | 'json' | undefined;
}

export async function handleAnalyzeCommand(
  pkgSpec: string,
  options: AnalyzeCliOptions = {},
): Promise<number> {
  if (!pkgSpec) {
    throw new UsageError('Missing package argument. Usage: deppulse analyze <package[@version]>');
  }

  // Parse package@version
  let name = pkgSpec;
  let version: string | undefined = undefined;

  const lastAtIndex = pkgSpec.lastIndexOf('@');
  if (lastAtIndex > 0) {
    name = pkgSpec.slice(0, lastAtIndex);
    version = pkgSpec.slice(lastAtIndex + 1);
  }

  const engine = new DepPulseEngine(getDefaultConfig());
  const health = await engine.analyze(name, version);

  if (options.format === 'json') {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(health, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(formatSinglePackageTerminal(health));
  }

  return 0;
}
