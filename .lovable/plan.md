## Plan to fix user creation visibility

1. **Fix the Create User backend call**
   - Update the user creation function so it always receives the submitted User ID, password, and display name correctly.
   - Return a clear response containing the created user ID and login ID instead of the current empty `{}` response.

2. **Make profile creation reliable**
   - After creating the login account, explicitly ensure the matching profile row exists in the database.
   - This avoids relying only on the database trigger timing, which is why the account can be created but not show in **All Users**.

3. **Improve the refresh behavior**
   - Refresh the **All Users** table only after the profile is confirmed.
   - Keep the create form open only if creation fails; otherwise clear the form and show the new row immediately.

4. **Add safer error messages**
   - If the User ID already exists, show a clear duplicate-user message.
   - If account creation succeeds but profile creation fails, show a precise message instead of silently missing the row.

5. **Verify**
   - Run the build/type check.
   - Confirm the database still has the correct profile trigger and that the User Management query reads newly-created profiles.

## Technical details

Likely root issue: the current server response is `{}`, so the client cannot confirm the created user. The backend currently relies on the auth-user trigger to insert `profiles`, but the UI polls `profiles` immediately. I will make the server function create/repair the profile row directly after creating the user, then return structured data for the UI to refresh against.