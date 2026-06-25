## Goal

Make the existing Email Configuration screen work cleanly with **Gmail SMTP + App Password**, and move the actual sending out of Supabase Edge Functions into a **TanStack server function** so the same code runs on your self-hosted deployment without needing `supabase functions deploy`.

## What changes

### 1. New TanStack server function — `src/lib/email.functions.ts`

- `sendEmail({ to, subject, html, text?, cc?, smtp? })` — admin-only via `requireSupabaseAuth` + `has_role('admin')` check.
- Loads SMTP config from `public.email_config` (same row the UI writes to) using the per-request authenticated client; falls back to inline `smtp` override for live test sends.
- Uses **`nodemailer`** (works on Node, which is what self-hosted will run). `bun add nodemailer @types/nodemailer`.
- Surfaces real SMTP errors (auth failed, connection refused, etc.) instead of swallowing them.

### 2. Update Email Configuration screen — `src/routes/email-config.tsx`

- Replace the `supabase.functions.invoke("send-email", ...)` test-send call with `useServerFn(sendEmail)`.
- Add a small **Gmail help block** under the SMTP fields:
  - Host: `smtp.gmail.com` · Port: `587` · Encryption: `TLS / STARTTLS`
  - Username: your full Gmail address
  - Password: 16-character **App Password** (not your Google account password)
  - Link text: "Generate an App Password at myaccount.google.com → Security → 2-Step Verification → App passwords. 2-Step Verification must be ON."
- No layout changes, no preset button — generic SMTP form stays.

### 3. Retire the edge function path

- Delete `supabase/functions/send-email/` so there's no second sender to keep in sync.
- Anywhere else in the app that called `supabase.functions.invoke("send-email", ...)` (e.g. password-reset flow if any) is switched to `sendEmail` server fn.

### 4. No schema or secret changes

- `public.email_config` already stores host / port / encryption / username / app_password / from / cc — keep as-is.
- No new env vars. Credentials stay in the DB so admins keep editing from the UI on both cloud and self-hosted.

## Self-hosted notes

- On your self-hosted server (Node runtime), `nodemailer` opens a normal SMTP socket to `smtp.gmail.com:587` — works out of the box.
- Same code, same DB row, same UI — nothing extra to deploy alongside Supabase.

## Important limitation to be aware of

On the **Lovable-hosted preview / published site** the server runtime is Cloudflare Workers, which **cannot open raw SMTP sockets**. The "Send Test Email" button will fail there with a connection error. It will work:
- on your **self-hosted** deployment (real Node), and
- locally with `bun run dev`.

If you also need test-send to work on the Lovable-hosted preview, the only options are (a) keep the Supabase edge function as a fallback sender, or (b) switch from SMTP to an HTTP email API (Resend, SendGrid, Gmail API w/ OAuth). Say the word and I'll fold one of those in.

## Verify

1. Save Gmail creds (`smtp.gmail.com`, 587, TLS, full address, 16-char app password) → **Send Test Email** → mail arrives, toast shows success.
2. Wrong password → toast shows Gmail's actual `Username and Password not accepted` error.
3. Self-hosted deploy: same screen, same behavior.
