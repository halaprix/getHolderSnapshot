import { readFile, writeFile } from 'node:fs/promises';

const BASE58_ALPHABET = /^[1-9A-HJ-NP-Za-km-z]+$/;
const MIN_BASE58_LEN = 32;
const MAX_BASE58_LEN = 44;

export async function readInput(path) {
  return readFile(path, 'utf8');
}

export async function writeJsonSnapshot(path, payload) {
  await writeFile(path, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

export function isLikelyBase58Pubkey(value) {
  if (typeof value !== 'string') return false;
  if (value.length < MIN_BASE58_LEN || value.length > MAX_BASE58_LEN) return false;
  return BASE58_ALPHABET.test(value);
}

export function parseMintList(raw) {
  const tokens = raw
    .split(/[\s,'"`\[\]{}()<>]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  const seen = new Set();
  const valid = [];
  const invalid = [];
  let duplicates = 0;

  for (const token of tokens) {
    if (seen.has(token)) {
      duplicates += 1;
      continue;
    }
    seen.add(token);

    if (isLikelyBase58Pubkey(token)) {
      valid.push(token);
    } else {
      invalid.push(token);
    }
  }

  return { valid, invalid, duplicates, total: tokens.length };
}

export function truncateMint(mint, head = 6, tail = 4) {
  if (typeof mint !== 'string' || mint.length <= head + tail + 1) return mint;
  return `${mint.slice(0, head)}…${mint.slice(-tail)}`;
}
