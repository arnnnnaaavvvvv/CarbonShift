import { DepPulseEngine } from '../../core/engine.js';
import { getDefaultConfig } from '../../core/config.js';
import { formatSinglePackageTerminal } from '../../reports/terminal.js';
import { UsageError } from '../../core/errors.js';

export async function handleExplainCommand(pkgSpec: string): Promise<number> {
  if (!pkgSpec) {
    throw new UsageError('Missing package argument. Usage: deppulse explain <package[@version]>');
  }

  let name = pkgSpec;
  let version: string | undefined = undefined;

  const lastAtIndex = pkgSpec.lastIndexOf('@');
  if (lastAtIndex > 0) {
    name = pkgSpec.slice(0, lastAtIndex);
    version = pkgSpec.slice(lastAtIndex + 1);
  }

  const engine = new DepPulseEngine(getDefaultConfig());
  const health = await engine.analyze(name, version);

  // eslint-disable-next-line no-console
  console.log(formatSinglePackageTerminal(health));
  return 0;
}
