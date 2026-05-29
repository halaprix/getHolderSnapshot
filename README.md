```
 ███████╗███╗   ██╗ █████╗ ██████╗ ███████╗██╗  ██╗ ██████╗ ████████╗
 ██╔════╝████╗  ██║██╔══██╗██╔══██╗██╔════╝██║  ██║██╔═══██╗╚══██╔══╝
 ███████╗██╔██╗ ██║███████║██████╔╝███████╗███████║██║   ██║   ██║
 ╚════██║██║╚██╗██║██╔══██║██╔═══╝ ╚════██║██╔══██║██║   ██║   ██║
 ███████║██║ ╚████║██║  ██║██║     ███████║██║  ██║╚██████╔╝   ██║
 ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝     ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝
                  Solana NFT holder snapshots, fast.
```

[![CI](https://github.com/halaprix/getHolderSnapshot/actions/workflows/ci.yml/badge.svg)](https://github.com/halaprix/getHolderSnapshot/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](./LICENSE)

`get-snapshot` reads a list of Solana NFT mint addresses and writes a JSON file telling you exactly which wallet holds each one. Concurrent RPC, automatic retry with jitter, structured output with metadata, and a CLI that doesn't feel like 2021.

## Features

- ⚡ **Concurrent RPC** — configurable parallelism (default 4, cap 25) with `p-limit`.
- 🔁 **Resilient** — `p-retry` with exponential backoff + jitter on transient RPC failures.
- 🔌 **BYO RPC** — flag or env var; default is public mainnet-beta with a loud warning.
- 📦 **Structured output** — `{ meta, snapshot, unresolved }`, not a bare array.
- 🧪 **Dry run mode** — validate input and print the plan without burning a single RPC call.
- 🧹 **Lenient input parsing** — line-, comma-, or quote-separated mints; dedupes; rejects bad base58 up front.

## Quickstart

```bash
npm install
SOLANA_RPC_URL=https://your-rpc.example node bin/get-snapshot.js -i examples/sample-input.txt -o holders.json
```

Or install globally:

```bash
npm install -g get-snapshot
get-snapshot -i mints.txt -o holders.json
```

## Prerequisites

- **Node.js ≥ 20** (LTS Iron). Older versions are unsupported.
- A Solana RPC endpoint. The default `https://api.mainnet-beta.solana.com` works for tiny lists but is heavily rate-limited. For anything serious, grab a free tier from [Helius](https://helius.dev), [QuickNode](https://quicknode.com), [Triton](https://triton.one), or [Alchemy](https://alchemy.com) and set `SOLANA_RPC_URL`.

## Installation

Via npm (once published):

```bash
npm install -g get-snapshot
```

Or from source:

```bash
git clone https://github.com/halaprix/getHolderSnapshot.git
cd getHolderSnapshot
npm install
```

## Usage

### Basic

```bash
get-snapshot -i mints.txt -o holders.json
```

### With a custom RPC and higher concurrency

```bash
SOLANA_RPC_URL=https://my-rpc.example \
  get-snapshot -i mints.txt -o holders.json --concurrency 10
```

### Verbose mode (per-mint log lines instead of a spinner)

```bash
get-snapshot -i mints.txt -o holders.json --verbose
```

### Dry run (validate input only, no network calls)

```bash
get-snapshot -i mints.txt -o holders.json --dry-run
```

## Input format

Plain text. Mints can be one per line, comma-separated, quoted, or any mix — the parser strips whitespace, brackets, quotes, and commas, then validates each token as base58. Invalid pubkeys fail the run before any RPC traffic.

```
88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt
DEVmZwWtjkzzrwyDt5etqgRnmdMwEyZzjAx1KEqiWjQz
G5uoPjGdHTmMq6g2RnMXQNhVjkLgUH3bAkKWWRgWjndR
```

Or the messier shape from the original tool — also fine:

```
"88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt",
"DEVmZwWtjkzzrwyDt5etqgRnmdMwEyZzjAx1KEqiWjQz",
```

## Output format

```json
{
  "meta": {
    "rpcUrl": "https://api.mainnet-beta.solana.com",
    "takenAt": "2026-05-29T10:42:11.317Z",
    "mintCount": 3,
    "resolved": 2,
    "unresolved": 1,
    "concurrency": 4
  },
  "snapshot": [
    { "mint": "88nNPPiYNrmmEVaWMyfrHgGniFoSc3MNpGWTjtEnKGvt", "holder": "9XyZ…" },
    { "mint": "DEVmZwWtjkzzrwyDt5etqgRnmdMwEyZzjAx1KEqiWjQz", "holder": "FaB7…" }
  ],
  "unresolved": [
    { "mint": "G5uoPjGdHTmMq6g2RnMXQNhVjkLgUH3bAkKWWRgWjndR", "reason": "no_holder_found" }
  ]
}
```

`unresolved.reason` is one of:

- `no_holder_found` — RPC returned no token account with `amount === "1"` (burned, frozen, or supply ≠ 1).
- `rpc_failed` — three retry attempts exhausted; the original error message is in `error`.

## Configuration

| Flag                    | Env var          | Default                       | Description                               |
| ----------------------- | ---------------- | ----------------------------- | ----------------------------------------- |
| `-i, --input <file>`    | —                | _(required)_                  | Path to mint address list                 |
| `-o, --output <file>`   | —                | _(required)_                  | Path to write snapshot JSON               |
| `-r, --rpc-url <url>`   | `SOLANA_RPC_URL` | `api.mainnet-beta.solana.com` | Solana RPC endpoint                       |
| `-c, --concurrency <n>` | —                | `4`                           | Parallel RPC requests (1–25)              |
| `--verbose`             | —                | `false`                       | Log every mint instead of using a spinner |
| `-q, --quiet`           | —                | `false`                       | Suppress banner, spinner, warnings        |
| `--dry-run`             | —                | `false`                       | Validate input only, skip RPC             |
| `-v, --version`         | —                | —                             | Print version and exit                    |
| `-h, --help`            | —                | —                             | Print help and exit                       |

## How it works

For each mint, `get-snapshot` calls Solana's [`getParsedProgramAccounts`](https://solana.com/docs/rpc/http/getprogramaccounts) against the SPL Token program with two filters:

1. `memcmp` at offset `0` matching the mint pubkey (token accounts start with their mint address).
2. `dataSize: 165` — the exact byte layout of an SPL Token v1 account (`44 + 32 + 8 + …`).

Among the matching accounts, the one with `tokenAmount.amount === "1"` is the holder. This is the canonical "where does this NFT live" query and matches what tools like Solscan and Helius do under the hood.

`getParsedProgramAccounts` is one of the most expensive Solana RPC methods — most providers gate it aggressively and the public endpoint will 429 you long before you hit any throughput limit. That's why concurrency is conservative by default.

## Performance & rate limits

| RPC tier                          | Safe concurrency       |
| --------------------------------- | ---------------------- |
| Public mainnet-beta               | 1–2                    |
| Free Helius / QuickNode / Alchemy | 4–8                    |
| Paid Helius / QuickNode / Triton  | 10–15 (some allow 25+) |

Each mint requires one RPC round-trip. For a typical 5k-holder collection on a paid RPC at `--concurrency 10`, expect 5–15 minutes depending on provider latency.

## Troubleshooting

### `! Using public RPC … expect 429s on large lists`

You're on the default endpoint. Get an RPC URL from any provider and set `SOLANA_RPC_URL`.

### `429 Too Many Requests` in `unresolved`

Drop `--concurrency`, switch RPC providers, or rerun. Failed mints are listed in `unresolved` with `reason: "rpc_failed"` so you can retry just those.

### `no_holder_found`

The NFT was burned, the supply isn't `1`, or it lives on Token-2022 instead of legacy SPL Token (see [Limitations](#limitations)).

### `Found N invalid pubkey(s) in input`

The parser found tokens that aren't valid base58 in the 32–44 length range. The run aborts with exit code `2` before any RPC traffic. Fix the input and rerun.

## Limitations

- **SPL Token v1 only.** Token-2022 mints (`TokenzQd…` program) are not yet covered — they'll appear in `unresolved` with `no_holder_found`.
- **NFT-style supply assumption.** The tool returns the wallet holding exactly `1` unit. SFTs and fungible tokens won't return useful results.
- **Snapshot, not subscription.** Holders change every block — this is a point-in-time read.

## Exit codes

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| `0`  | Success                                             |
| `1`  | Usage error (missing flags, legacy positional args) |
| `2`  | Input validation failed (invalid base58)            |
| `3`  | Failed to write output file                         |
| `4`  | All RPC calls failed                                |

## Contributing

PRs welcome. Before opening one:

```bash
npm install
npm run format
npm test
```

CI runs format check + smoke tests on Node 20 and 22.

## License

[ISC](./LICENSE) © halaprix
