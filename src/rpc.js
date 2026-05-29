import { Connection, PublicKey } from '@solana/web3.js';
import pRetry, { AbortError } from 'p-retry';

// Legacy SPL Token program. Token-2022 (TokenzQd…) is NOT covered — see README.
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// SPL Token Account layout = 165 bytes (44 mint + 32 owner + 8 amount + …).
export const TOKEN_ACCOUNT_SIZE = 165;
export const MINT_FILTER_OFFSET = 0;

const RETRY_OPTIONS = {
  retries: 3,
  factor: 2,
  minTimeout: 1000,
  maxTimeout: 10000,
  randomize: true,
};

export function createConnection(rpcUrl) {
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    disableRetryOnRateLimit: true,
  });
}

function isInvalidPubkeyError(err) {
  const msg = err?.message ?? '';
  return /Invalid public key|Non-base58 character/i.test(msg);
}

async function fetchTokenAccountsForMint(connection, mintPublicKey) {
  return connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
    encoding: 'jsonParsed',
    filters: [
      { memcmp: { offset: MINT_FILTER_OFFSET, bytes: mintPublicKey.toBase58() } },
      { dataSize: TOKEN_ACCOUNT_SIZE },
    ],
  });
}

function pickHolder(accounts) {
  for (const { account } of accounts) {
    const info = account?.data?.parsed?.info;
    if (!info) continue;
    if (info.tokenAmount?.amount === '1') {
      return info.owner;
    }
  }
  return null;
}

export async function getNftOwner(connection, mintAddress) {
  return pRetry(async () => {
    let mintPubkey;
    try {
      mintPubkey = new PublicKey(mintAddress);
    } catch (err) {
      throw new AbortError(err);
    }

    try {
      const accounts = await fetchTokenAccountsForMint(connection, mintPubkey);
      return pickHolder(accounts);
    } catch (err) {
      if (isInvalidPubkeyError(err)) throw new AbortError(err);
      throw err;
    }
  }, RETRY_OPTIONS);
}
