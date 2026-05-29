#!/usr/bin/env node
import { Command, Option } from 'commander';
import kleur from 'kleur';

import { EXIT_CODES, runSnapshot } from '../src/snapshot.js';

const DEFAULT_RPC_URL = 'https://api.mainnet-beta.solana.com';
const DEFAULT_CONCURRENCY = 4;

const BANNER = String.raw`
 ███████╗███╗   ██╗ █████╗ ██████╗ ███████╗██╗  ██╗ ██████╗ ████████╗
 ██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██║  ██║██╔═══██╗╚══██╔══╝
 ███████╗██╔██╗ ██║███████║██████╔╝███████╗███████║██║   ██║   ██║
 ╚════██║██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══██║██║   ██║   ██║
 ███████║██║ ╚████║██║  ██║██║     ███████║██║  ██║╚██████╔╝   ██║
 ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝
                  Solana NFT holder snapshots, fast.
`;

const HELP_EXAMPLES = `
Examples:
  $ get-snapshot -i mints.txt -o holders.json
  $ get-snapshot -i mints.txt -o holders.json --concurrency 10 --verbose
  $ SOLANA_RPC_URL=https://my-rpc.example get-snapshot -i mints.txt -o holders.json
  $ get-snapshot -i mints.txt -o holders.json --dry-run
`;

function maybePrintBanner({ quiet }) {
  if (quiet) return;
  if (!process.stdout.isTTY) return;
  process.stdout.write(kleur.magenta(BANNER));
}

function detectLegacyPositionalArgs(argv) {
  if (argv.length !== 2) return null;
  if (argv.some((a) => a.startsWith('-'))) return null;
  const [first, second] = argv;
  if (/\.txt$/i.test(first) && /\.json$/i.test(second)) {
    return { input: first, output: second };
  }
  return null;
}

function buildProgram() {
  const program = new Command();

  program
    .name('get-snapshot')
    .description('Snapshot Solana NFT holders from a list of mint addresses.')
    .version('2.0.0', '-v, --version', 'print version and exit')
    .requiredOption(
      '-i, --input <file>',
      'path to mint address list (one per line, comma- or whitespace-separated)',
    )
    .requiredOption('-o, --output <file>', 'path to write the holder snapshot JSON')
    .addOption(
      new Option('-r, --rpc-url <url>', 'Solana RPC endpoint')
        .env('SOLANA_RPC_URL')
        .default(DEFAULT_RPC_URL, 'public mainnet-beta (rate-limited)'),
    )
    .option(
      '-c, --concurrency <n>',
      'parallel RPC requests (1-25)',
      (raw) => {
        const n = Number.parseInt(raw, 10);
        if (!Number.isFinite(n) || n < 1) {
          throw new Error(`--concurrency must be a positive integer (got "${raw}")`);
        }
        return n;
      },
      DEFAULT_CONCURRENCY,
    )
    .option('--verbose', 'log every mint instead of using a spinner', false)
    .option('-q, --quiet', 'suppress banner, spinner, and non-essential output', false)
    .option('--dry-run', 'validate input and print plan without making RPC calls', false)
    .addHelpText('after', HELP_EXAMPLES);

  return program;
}

function warnIfUsingPublicRpc(rpcUrl, quiet) {
  if (quiet) return;
  if (rpcUrl !== DEFAULT_RPC_URL) return;
  process.stderr.write(
    kleur.yellow(
      `! Using public RPC (${DEFAULT_RPC_URL}). Expect 429s on large lists.\n` +
        `  Set SOLANA_RPC_URL or pass --rpc-url to use Helius / QuickNode / Triton / Alchemy.\n\n`,
    ),
  );
}

async function main() {
  const legacy = detectLegacyPositionalArgs(process.argv.slice(2));
  if (legacy) {
    process.stderr.write(
      kleur.yellow(
        `Heads up: positional args were removed in v2.\n` +
          `  Use: get-snapshot -i ${legacy.input} -o ${legacy.output}\n`,
      ),
    );
    process.exit(EXIT_CODES.USAGE);
  }

  const program = buildProgram();
  program.parse(process.argv);
  const opts = program.opts();

  maybePrintBanner({ quiet: opts.quiet });
  warnIfUsingPublicRpc(opts.rpcUrl, opts.quiet);

  const result = await runSnapshot({
    inputFile: opts.input,
    outputFile: opts.output,
    rpcUrl: opts.rpcUrl,
    concurrency: opts.concurrency,
    verbose: opts.verbose,
    quiet: opts.quiet,
    dryRun: opts.dryRun,
  });

  process.exit(result.code);
}

main().catch((err) => {
  process.stderr.write(kleur.red(`\nFatal: ${err?.stack ?? err}\n`));
  process.exit(EXIT_CODES.USAGE);
});
