## Add `deploy.sh` + `DEPLOY.md` to the repo

Move the two artifacts currently in `/mnt/documents/dlax-deploy/` into the project root so they're tracked in git and ship with every clone/zip of the repo.

### Files to add (at repo root)

- `deploy.sh` — one-shot Ubuntu deployer (same content already generated)
- `DEPLOY.md` — usage guide

Both go at the root (not under `scripts/`) so users can run `./deploy.sh` immediately after cloning, matching the pattern the v17 self-host bundle already uses with `install.sh`.

### Steps

1. Copy `/mnt/documents/dlax-deploy/deploy.sh` → `deploy.sh` (repo root).
2. Copy `/mnt/documents/dlax-deploy/DEPLOY.md` → `DEPLOY.md` (repo root).
3. Ensure `deploy.sh` is executable (`chmod +x`).

### Out of scope

- No code/app changes.
- No changes to the v17 self-host bundle itself.

Approve and I'll commit them on the next turn.