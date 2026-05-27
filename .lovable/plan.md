## Diagnosis

The new line is the root cause:

```text
./.env: line 27: Backend: command not found
```

In v5, `scripts/repair-db-roles.sh` uses shell `source .env`. Your `.env` contains:

```text
STUDIO_DEFAULT_PROJECT=DLAX Backend
```

Because of the space, Bash treats `Backend` as a command, so the repair script exits before it can reset `supabase_auth_admin`. That is why the same auth password error continues.

## Plan for v6

1. **Patch the repair script**
   - Stop sourcing the whole `.env` file.
   - Read only `POSTGRES_PASSWORD` safely using a line parser that tolerates other values with spaces.
   - Keep the role password reset idempotent.

2. **Patch the packaged `.env.example`**
   - Make `STUDIO_DEFAULT_PROJECT` shell-safe so future helper scripts do not break on values with spaces.
   - Review other `.env.example` values for the same issue.

3. **Make install recovery clearer**
   - Keep `install.sh` running the repair step after `docker compose up -d`.
   - Update the warning text so if repair fails, it prints the exact recovery script to run.

4. **Update README troubleshooting**
   - Add this exact symptom:
     ```text
     ./.env: line 27: Backend: command not found
     ```
   - Explain that v5 failed before repairing DB role passwords.
   - Include the rerun command:
     ```bash
     sudo bash install.sh
     ```

5. **Package the corrected archive**
   - Build:
     ```text
     /mnt/documents/dlax-selfhost-complete-v6.zip
     ```
   - Provide the new download link after packaging.