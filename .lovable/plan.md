## Issue

`/mnt/documents/dlax-selfhost-complete-v3.zip` doesn't exist on disk — only v1 and v2 are there. The download fails because there's no file to serve.

## Fix

Rebuild v3 from the v2 bundle with the healthcheck fix applied:

1. Unzip `dlax-selfhost-complete-v2.zip` to a working dir.
2. Patch `scripts/healthcheck.sh` — replace the Kong probe (and the matching studio probe) so `curl` doesn't fail on 4xx:
   ```bash
   wait_for kong "code=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:\${KONG_HTTP_PORT:-8000}/); [[ \"\$code\" =~ ^(200|401|404)$ ]]"
   ```
3. Append a "Troubleshooting → Kong healthcheck exit 1" note to `README.md` with the in-place `sed` one-liner so anyone on v2 can patch without re-downloading.
4. Zip back to `/mnt/documents/dlax-selfhost-complete-v3.zip`.
5. Re-emit the `<presentation-artifact>` download link.

Approve and I'll switch to build mode and produce v3.