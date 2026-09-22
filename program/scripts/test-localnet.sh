#!/usr/bin/env bash
#
# Run the program tests against a throwaway local validator.
#
# `anchor test` no longer does this: Anchor CLI 1.2.0 spawns `surfpool` instead
# of `solana-test-validator`, and surfpool is not part of this toolchain. Rather
# than add another binary to the setup, the work that command used to do is
# written out here — start a validator with the built program at its declared
# address, wait until it answers, run vitest, then take the validator and its
# ledger back down whatever happens.
#
# It also exists because the alternative is a one-line shell incantation that
# has to be retyped correctly every time. It was mistyped three times during
# S3.5 handover alone, each time in a way that still produced output and so
# looked like a real failure.
#
# Usage:
#   pnpm test:program                                    # from the repo root
#   bash program/scripts/test-localnet.sh -t refund      # extra args go to vitest
#
# Options:
#   --use-running  Run against a validator that is already listening instead of
#                  starting one. Only correct if that validator already has
#                  tip_vault deployed at the address in Anchor.toml.
set -euo pipefail

RPC_URL="http://127.0.0.1:8899"
READY_TIMEOUT_SECONDS=60

die() {
  printf '[test-localnet] %s\n' "$*" >&2
  exit 1
}

note() {
  printf '[test-localnet] %s\n' "$*"
}

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
program_dir=$(dirname -- "$script_dir")
cd -- "$program_dir"

use_running=0
vitest_args=()
for arg in "$@"; do
  if [ "$arg" = "--use-running" ]; then
    use_running=1
  else
    vitest_args+=("$arg")
  fi
done

# Read the address out of Anchor.toml rather than repeating it here: a rotated
# program key must not be able to leave the tests pointing at the old one while
# still passing.
program_id=$(sed -n '/^\[programs\.localnet\]/,/^\[/s/^tip_vault[[:space:]]*=[[:space:]]*"\(.*\)"/\1/p' Anchor.toml | head -1)
if [ -z "$program_id" ]; then
  die "could not read tip_vault's address from ${program_dir}/Anchor.toml"
fi

so_path="target/deploy/tip_vault.so"
if [ ! -f "$so_path" ]; then
  die "${program_dir}/${so_path} is missing. Run 'anchor build' first."
fi

wallet="${ANCHOR_WALLET:-${HOME}/.config/solana/id.json}"
if [ ! -f "$wallet" ]; then
  die "no payer keypair at ${wallet}. Run 'solana-keygen new', or point ANCHOR_WALLET somewhere else."
fi

# The program hard-codes the attestation authority, so the claim scenarios
# cannot run without its key. Saying so once here beats six identical failures.
if [ ! -f "keys/attestation-authority-devnet.json" ]; then
  die "keys/attestation-authority-devnet.json is missing. It is gitignored on purpose — restore it from your backup."
fi

for binary in solana solana-test-validator pnpm; do
  if ! command -v "$binary" >/dev/null 2>&1; then
    die "${binary} is not on PATH."
  fi
done

validator_pid=""
ledger_dir=""

cleanup() {
  local code=$?
  if [ -n "$validator_pid" ] && kill -0 "$validator_pid" 2>/dev/null; then
    note "stopping the validator"
    kill "$validator_pid" 2>/dev/null || true
    # Give it a moment to flush and exit on its own before insisting.
    for _ in $(seq 1 20); do
      if ! kill -0 "$validator_pid" 2>/dev/null; then
        break
      fi
      sleep 0.25
    done
    kill -9 "$validator_pid" 2>/dev/null || true
    wait "$validator_pid" 2>/dev/null || true
  fi
  if [ -n "$ledger_dir" ] && [ -d "$ledger_dir" ]; then
    rm -rf -- "$ledger_dir"
  fi
  exit "$code"
}
trap cleanup EXIT INT TERM

if solana cluster-version --url "$RPC_URL" >/dev/null 2>&1; then
  if [ "$use_running" -eq 0 ]; then
    die "something is already listening on ${RPC_URL}. Stop it, or pass --use-running if it already has tip_vault at ${program_id}."
  fi
  note "using the validator already listening on ${RPC_URL}"
else
  if [ "$use_running" -eq 1 ]; then
    die "--use-running was passed, but nothing answers on ${RPC_URL}."
  fi

  # The ledger lives outside the repository so that a crashed run cannot leave
  # a few hundred megabytes of it behind in a working tree.
  ledger_dir=$(mktemp -d -t tipvault-ledger-XXXXXX)
  log_file="${ledger_dir}/validator.log"

  note "starting a validator with tip_vault at ${program_id}"
  solana-test-validator \
    --reset \
    --quiet \
    --ledger "${ledger_dir}/ledger" \
    --bpf-program "$program_id" "$so_path" \
    >"$log_file" 2>&1 &
  validator_pid=$!

  deadline=$((SECONDS + READY_TIMEOUT_SECONDS))
  until solana cluster-version --url "$RPC_URL" >/dev/null 2>&1; do
    if ! kill -0 "$validator_pid" 2>/dev/null; then
      tail -n 20 "$log_file" >&2 || true
      validator_pid=""
      die "the validator exited before it was ready (last lines above)."
    fi
    if [ "$SECONDS" -ge "$deadline" ]; then
      tail -n 20 "$log_file" >&2 || true
      die "the validator did not answer within ${READY_TIMEOUT_SECONDS}s (last lines above)."
    fi
    sleep 0.25
  done
  note "validator ready"
fi

export ANCHOR_PROVIDER_URL="$RPC_URL"
export ANCHOR_WALLET="$wallet"

status=0
pnpm run test:localnet "${vitest_args[@]}" || status=$?
exit "$status"
