import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const binPath = join(repoRoot, 'bin', 'get-snapshot.js');
const sampleInput = join(repoRoot, 'examples', 'sample-input.txt');

test('io: parseMintList tokenizes, dedupes, and validates', async () => {
  const { parseMintList, isLikelyBase58Pubkey, truncateMint } = await import('../src/io.js');

  const result = parseMintList(`
    "88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt",
    "DEVmZwWtjkzzrwyDt5etqgRnmdMwEyZzjAx1KEqiWjQz"
    88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt
    not-a-valid-pubkey
  `);

  assert.equal(result.valid.length, 2);
  assert.equal(result.invalid.length, 1);
  assert.equal(result.duplicates, 1);
  assert.ok(result.valid.includes('88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt'));
  assert.ok(result.invalid.includes('not-a-valid-pubkey'));

  assert.equal(isLikelyBase58Pubkey('88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt'), true);
  assert.equal(isLikelyBase58Pubkey('hello'), false);
  assert.equal(isLikelyBase58Pubkey('0OIl_invalid_chars_for_base58_xxxx'), false);

  assert.equal(truncateMint('88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt'), '88nNPP…KGvt');
});

test('rpc: exports the expected surface and constants', async () => {
  const rpc = await import('../src/rpc.js');
  assert.equal(typeof rpc.createConnection, 'function');
  assert.equal(typeof rpc.getNftOwner, 'function');
  assert.equal(rpc.TOKEN_ACCOUNT_SIZE, 165);
  assert.equal(rpc.MINT_FILTER_OFFSET, 0);
  assert.equal(rpc.TOKEN_PROGRAM_ID.toBase58(), 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
});

test('snapshot: exports runSnapshot and exit code map', async () => {
  const mod = await import('../src/snapshot.js');
  assert.equal(typeof mod.runSnapshot, 'function');
  assert.equal(mod.EXIT_CODES.SUCCESS, 0);
  assert.equal(mod.EXIT_CODES.INVALID_INPUT, 2);
});

test('cli: --dry-run validates input without making RPC calls', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'get-snapshot-'));
  const outPath = join(tmp, 'out.json');
  try {
    const result = spawnSync(
      process.execPath,
      [binPath, '-i', sampleInput, '-o', outPath, '--dry-run', '--quiet'],
      { encoding: 'utf8', timeout: 10_000 },
    );
    assert.equal(
      result.status,
      0,
      `expected exit 0, got ${result.status}. stderr: ${result.stderr}`,
    );
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('cli: legacy positional args print a friendly hint and exit 1', () => {
  const result = spawnSync(process.execPath, [binPath, 'foo.txt', 'bar.json'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /positional args were removed/i);
});

test('cli: --help mentions examples', () => {
  const result = spawnSync(process.execPath, [binPath, '--help'], {
    encoding: 'utf8',
    timeout: 5_000,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Examples:/);
  assert.match(result.stdout, /--concurrency/);
});

test('cli: missing required flags exits non-zero', () => {
  const result = spawnSync(process.execPath, [binPath], { encoding: 'utf8', timeout: 5_000 });
  assert.notEqual(result.status, 0);
});

test('snapshot: empty input writes a valid empty snapshot', async () => {
  const { runSnapshot, EXIT_CODES } = await import('../src/snapshot.js');
  const tmp = mkdtempSync(join(tmpdir(), 'get-snapshot-empty-'));
  const inPath = join(tmp, 'empty.txt');
  const outPath = join(tmp, 'out.json');
  try {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(inPath, '');
    const silentLogger = { log: () => {}, error: () => {}, warn: () => {} };
    const result = await runSnapshot({
      inputFile: inPath,
      outputFile: outPath,
      rpcUrl: 'https://unused.example',
      concurrency: 1,
      quiet: true,
      logger: silentLogger,
    });
    assert.equal(result.code, EXIT_CODES.SUCCESS);
    const payload = JSON.parse(readFileSync(outPath, 'utf8'));
    assert.deepEqual(payload.snapshot, []);
    assert.equal(payload.meta.mintCount, 0);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
