import { Command } from 'commander';
import pc from 'picocolors';
import { handleScanCommand } from './commands/scan.js';
import { handleAnalyzeCommand } from './commands/analyze.js';
import { handleCompareCommand } from './commands/compare.js';
import { handleExplainCommand } from './commands/explain.js';
import { DepPulseError, PolicyViolationError } from '../core/errors.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('deppulse')
    .description('Dependency health and upgrade intelligence CLI for Node.js')
    .version('0.1.0');

  program
    .command('scan [path]')
    .description('Scan project dependencies, evaluate maintenance risk, and enforce health policies')
    .option('-f, --format <format>', 'Output format: terminal, json, markdown', 'terminal')
    .option('--fail-on <risk>', 'Fail build on risk level: low, medium, high, critical, unknown')
    .option('--no-cache', 'Bypass local response cache')
    .option('-o, --output <file>', 'Save output report to file')
    .option('-c, --config <file>', 'Path to custom configuration file')
    .option('-v, --verbose', 'Show detailed output including healthy packages', false)
    .action(async (targetPath: string | undefined, options) => {
      await handleScanCommand(targetPath ?? '.', options);
    });

  program
    .command('analyze <package>')
    .description('Inspect telemetry, maintenance signals, and health score for a single package')
    .option('-f, --format <format>', 'Output format: terminal, json', 'terminal')
    .action(async (pkg: string, options) => {
      await handleAnalyzeCommand(pkg, options);
    });

  program
    .command('compare <package>')
    .description('Compare upgrade risk between two package versions')
    .requiredOption('--from <version>', 'Current version')
    .requiredOption('--to <version>', 'Target version')
    .option('-f, --format <format>', 'Output format: terminal, json', 'terminal')
    .action(async (pkg: string, options) => {
      await handleCompareCommand(pkg, options);
    });

  program
    .command('explain <package>')
    .description('Audit trail explaining the exact facts and rules leading to a health score')
    .action(async (pkg: string) => {
      await handleExplainCommand(pkg);
    });

  return program;
}

export async function runCli(argv = process.argv): Promise<void> {
  const program = createProgram();

  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof PolicyViolationError) {
      // Policy violation: exit code 1
      if (err.recoveryHint) {
        console.error(pc.dim(`Tip: ${err.recoveryHint}`));
      }
      process.exitCode = 1;
    } else if (err instanceof DepPulseError) {
      // Runtime or usage error: exit code 2
      console.error(pc.red(`\nError [${err.category}]: ${err.message}`));
      if (err.recoveryHint) {
        console.error(pc.yellow(`Recovery Hint: ${err.recoveryHint}\n`));
      }
      process.exitCode = 2;
    } else {
      // Unhandled runtime error: exit code 2
      console.error(pc.red(`\nUnexpected Error: ${(err as Error).message}\n`));
      process.exitCode = 2;
    }
  }
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('deppulse.js') || process.argv[1]?.endsWith('index.js')) {
  runCli();
}
