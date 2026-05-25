## Findings

### Issue 1 — "Submitted By" shows "—" (real bug)
The `profiles` table SELECT policy only allows `auth.uid() = user_id`, so a logged-in approver can only read their **own** profile row. When the Approvals page loads `profiles` to map `submitted_by` → name, every other user's row is filtered out by RLS → the column renders "—".

This is the same root cause that would block showing approver names, submitter names, etc. anywhere in the app.

### Issue 2 — Only one approver receives the sheet (by design, not a bug)
Sheet `DE-000030` (project GENMNGR) is currently `pending`, `current_level = 1`. Your approval config for GENMNGR is:
- L1 = harshini
- L2 = mounika

The system is **sequential**: L2 only sees a sheet after L1 approves it. That is why harshini sees it now and mounika sees 0. Once harshini clicks Approve, `current_level` becomes 2 and the sheet appears in mounika's "My Approvals" tab.

I verified mounika has project access to GENMNGR via `user_projects`, so RLS will not block her once it advances to L2.

If your expectation was that **both** approvers see it at the same time, that's a different design (parallel approval) and would need a separate change — let me know if that's what you want.

## Plan

### 1. Fix profiles visibility (Option 1)
Add a database policy so any authenticated user can read the minimal fields needed to display names (`user_id`, `display_name`, `login_id`) of other users. Two safe options:

- **Recommended:** Add a permissive SELECT policy on `profiles` for `authenticated` role allowing read of all rows. Profiles in this app only contain display name / login id (no PII like email/phone) and are already needed across Approvals, Submissions, Approval Config, Users screens.
- Existing "Users can view own profile" policy stays (harmless — PERMISSIVE policies OR together).

No code change needed in `src/routes/approvals.tsx` — the existing profile lookup will start returning all rows and "Submitted By" will populate automatically.

### 2. Option 2
No code change unless you confirm you want **parallel** approval (all configured approvers see the sheet simultaneously, any/all must approve). Default behavior — sequential L1 → L2 — is working as designed.

## Question for you
For Option 2, do you want to:
- **(a)** Keep the current sequential flow (L1 first, then L2) — no change needed; or
- **(b)** Switch to parallel — both L1 and L2 see the sheet at the same time?
