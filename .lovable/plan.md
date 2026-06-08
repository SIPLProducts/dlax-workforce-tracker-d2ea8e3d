Apply strict 10-digit numeric validation **only** on the **Contact Number** field in `src/routes/masters.contractors.tsx`.

### 1. Input sanitization (dialog form, line ~433)
- Replace `onChange` with a sanitizer: `value.replace(/\D/g, "").slice(0, 10)`.
- Add `inputMode="numeric"`, `maxLength={10}`, `placeholder="10-digit mobile number"`.

### 2. Submit validation (`handleSave`, line ~162)
- If `contact_number` is non-empty, require exactly 10 digits; else `toast.error("Contact Number must be exactly 10 digits")` and abort save.
- Phone field remains unchanged (no validation).

### 3. CSV import (upload path, line ~288)
- During per-row object construction, sanitize `contact_number` with the same rule: strip non-digits, take first 10.
- If a non-empty value doesn't produce exactly 10 digits, clear it for that row (don't block the entire import).

No DB schema changes. No other screens affected.