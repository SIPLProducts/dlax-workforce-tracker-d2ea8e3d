## Root cause

`install.sh` aborts at line 104 with **exit 141** (SIGPIPE) when running `scripts/gen-secrets.sh`.

The culprit is this line in `gen-secrets.sh`:

```bash
rand_pw() { tr -dc 'A-Za-z0-9' </dev/urandom | head -c "${1:-32}"; }
```

Because the script runs under `set -Eeuo pipefail`, the moment `head` has read N bytes it closes the pipe, `tr` gets SIGPIPE (exit 141), and `pipefail` propagates that failure → the whole installer dies before `.env` is written.

This is a bug in the bundle, not anything wrong with your server. It will reproduce on every fresh install on modern bash + coreutils.

## Fix

Patch `scripts/gen-secrets.sh` so the password helpers can't be killed by SIGPIPE.

Replace `rand_pw` with a bounded-input variant:

```bash
rand_pw() {
  local n="${1:-32}"
  # Read enough random bytes up front, then filter — no infinite pipe, no SIGPIPE.
  LC_ALL=C tr -dc 'A-Za-z0-9' < <(openssl rand -base64 $(( n * 4 ))) | head -c "$n"
}
```

(or equivalently wrap the existing pipe in a subshell with `set +o pipefail`).

Also harden `b64url` the same way isn't needed — it consumes a finite stdin.

## Rebuild and redeliver

1. Update `scripts/gen-secrets.sh` inside the source tree.
2. Bump the bundle to `dlax-selfhost-complete-v2.zip` at `/mnt/documents/`.
3. README: add a short "Troubleshooting → exit 141 on first install" note pointing at this fix, so anyone with the old zip can patch in place without re-downloading:
   ```bash
   sed -i 's|tr -dc .A-Za-z0-9. </dev/urandom | head -c|...|' scripts/gen-secrets.sh
   ```
   (exact sed shown in README).

## Quick manual unblock (so you don't have to wait for the new zip)

On the server, edit `/home/ubuntu/dlax-selfhost-supabase/scripts/gen-secrets.sh` and change the `rand_pw` function to the version above, then re-run:

```bash
sudo bash install.sh
```

The installer is idempotent — it will pick up where it failed (generate `.env`, pull images, start stack, run migrations + seed).

Approve and I'll switch to build mode, patch the script, and produce `dlax-selfhost-complete-v2.zip`.