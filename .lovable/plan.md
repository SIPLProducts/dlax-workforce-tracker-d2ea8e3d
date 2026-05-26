# Fix: Show submitter's User ID under "Submitted By" in Approvals

## Root cause
`approvals.tsx` fetches submitter info via `supabase.from("profiles").select(...)`, but the `profiles` RLS policy is `auth.uid() = user_id` — each user can only read their own row. So the approver receives only their own profile, and `profiles[s.submitted_by]` resolves to "—".

## Change

### 1. Migration — SECURITY DEFINER RPC for safe public profile lookup
```sql
CREATE OR REPLACE FUNCTION public.get_user_display_info(_user_ids uuid[])
RETURNS TABLE(user_id uuid, login_id text, display_name text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, login_id, display_name
  FROM public.profiles
  WHERE user_id = ANY(_user_ids);
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_display_info(uuid[]) TO authenticated;
```
Exposes only `login_id` + `display_name` (no email). Safe for any signed-in user.

### 2. `src/routes/approvals.tsx`
- Replace the `profiles` table query in `load()` with an RPC call: `supabase.rpc("get_user_display_info", { _user_ids })`.
- Collect `_user_ids` as the union of:
  - all `submitted_by` from fetched sheets, and
  - all `approver_user_id` from `project_approval_levels`.
- Build the `profiles` map keyed by `user_id`, with value preferring `login_id` (the User ID) → `display_name` → short id, so the **Submitted By** column shows the User ID.

## Out of scope
- `profiles` table RLS is unchanged.
- No changes to Daily Entry, Reports, masters, or approval workflow logic.
