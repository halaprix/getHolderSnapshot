import { performance } from 'node:perf_hooks';
import kleur from 'kleur';
import ora from 'ora';
import pLimit from 'p-limit';

import { parseMintList, readInput, truncateMint, writeJsonSnapshot } from './io.js';
import { createConnection, getNftOwner } from './rpc.js';

export const EXIT_CODES = Object.freeze({
  SUCCESS: 0,
  USAGE: 1,
  INVALID_INPUT: 2,
  WRITE_ERROR: 3,
  ALL_RPC_FAILED: 4,
});

const HARD_CONCURRENCY_CAP = 25;

export async function runSnapshot(options) {
  const {
    inputFile,
    outputFile,
    rpcUrl,
    concurrency,
    verbose = false,
    quiet = false,
    dryRun = false,
    logger = console,
  } = options;

  const startedAt = performance.now();

  const raw = await readInput(inputFile);
  const { valid, invalid, duplicates, total } = parseMintList(raw);

  if (invalid.length > 0) {
    logger.error(kleur.red(`Found ${invalid.length} invalid pubkey(s) in input:`));
    for (const bad of invalid) logger.error(kleur.red(`  • ${bad}`));
    return { code: EXIT_CODES.INVALID_INPUT, resolved: 0, missing: 0, failed: 0 };
  }

  if (duplicates > 0 && !quiet) {
    logger.log(kleur.dim(`Deduped ${duplicates} repeated mint${duplicates === 1 ? '' : 's'}.`));
  }

  if (valid.length === 0) {
    if (!quiet) logger.log(kleur.yellow('No mints to process — writing empty snapshot.'));
    await writeEmptySnapshot(outputFile, rpcUrl);
    return { code: EXIT_CODES.SUCCESS, resolved: 0, missing: 0, failed: 0 };
  }

  if (dryRun) {
    logger.log(kleur.cyan(`Dry run: would resolve ${valid.length} mint(s) via ${rpcUrl}.`));
    logger.log(
      kleur.dim(
        `Parsed ${total} token(s) → ${valid.length} valid, ${invalid.length} invalid, ${duplicates} duplicates.`,
      ),
    );
    return { code: EXIT_CODES.SUCCESS, resolved: 0, missing: 0, failed: 0, dryRun: true };
  }

  const cappedConcurrency = Math.min(Math.max(1, concurrency), HARD_CONCURRENCY_CAP);
  if (concurrency > HARD_CONCURRENCY_CAP && !quiet) {
    logger.warn(
      kleur.yellow(
        `Concurrency capped at ${HARD_CONCURRENCY_CAP} (you asked for ${concurrency}). ` +
          `getParsedProgramAccounts is expensive — most RPCs will throttle higher values.`,
      ),
    );
  }

  const connection = createConnection(rpcUrl);
  const limit = pLimit(cappedConcurrency);
  const spinner = !quiet && !verbose ? ora({ text: 'Starting…', spinner: 'dots' }).start() : null;

  const snapshot = [];
  const unresolved = [];
  let completed = 0;

  const work = valid.map((mint, idx) =>
    limit(async () => {
      const label = `[${idx + 1}/${valid.length}] ${truncateMint(mint)}`;
      try {
        const holder = await getNftOwner(connection, mint);
        completed += 1;

        if (holder) {
          snapshot.push({ mint, holder });
          if (verbose) logger.log(`${kleur.green('✓')} ${label} → ${holder}`);
          else if (spinner) spinner.text = `${label} → ${truncateMint(holder)}`;
        } else {
          unresolved.push({ mint, reason: 'no_holder_found' });
          if (verbose) logger.log(`${kleur.yellow('⚠')} ${label} no holder found`);
          else if (spinner) spinner.text = `${label} no holder`;
        }
      } catch (err) {
        completed += 1;
        unresolved.push({ mint, reason: 'rpc_failed', error: err?.message ?? String(err) });
        if (verbose) logger.log(`${kleur.red('✗')} ${label} ${err?.message ?? err}`);
        else if (spinner) spinner.text = `${label} failed`;
      }
    }),
  );

  await Promise.all(work);

  const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
  const resolved = snapshot.length;
  const missing = unresolved.filter((u) => u.reason === 'no_holder_found').length;
  const failed = unresolved.filter((u) => u.reason === 'rpc_failed').length;

  if (spinner) {
    if (failed === 0 && missing === 0)
      spinner.succeed(`Resolved all ${resolved} holders in ${elapsed}s`);
    else spinner.stopAndPersist({ symbol: kleur.cyan('»'), text: `Finished in ${elapsed}s` });
  }

  try {
    await writeJsonSnapshot(outputFile, {
      meta: {
        rpcUrl,
        takenAt: new Date().toISOString(),
        mintCount: valid.length,
        resolved,
        unresolved: unresolved.length,
        concurrency: cappedConcurrency,
      },
      snapshot,
      unresolved,
    });
  } catch (err) {
    logger.error(kleur.red(`Failed to write ${outputFile}: ${err?.message ?? err}`));
    return { code: EXIT_CODES.WRITE_ERROR, resolved, missing, failed };
  }

  if (!quiet) printSummary({ logger, elapsed, resolved, missing, failed, outputFile });

  if (failed === valid.length) {
    return { code: EXIT_CODES.ALL_RPC_FAILED, resolved, missing, failed };
  }
  return { code: EXIT_CODES.SUCCESS, resolved, missing, failed };
}

async function writeEmptySnapshot(outputFile, rpcUrl) {
  await writeJsonSnapshot(outputFile, {
    meta: {
      rpcUrl,
      takenAt: new Date().toISOString(),
      mintCount: 0,
      resolved: 0,
      unresolved: 0,
    },
    snapshot: [],
    unresolved: [],
  });
}

function printSummary({ logger, elapsed, resolved, missing, failed, outputFile }) {
  logger.log('');
  logger.log(kleur.bold(`Done in ${elapsed}s`));
  logger.log(
    `  ${kleur.green(`Resolved: ${resolved}`)}` +
      `   ${kleur.yellow(`Missing: ${missing}`)}` +
      `   ${kleur.red(`Failed: ${failed}`)}`,
  );
  logger.log(`  ${kleur.dim('Output:')} ${outputFile}`);
}
