# Phone number as an alternate login identifier

## What changes for the user
- The first login step accepts either an email **or** a phone number in one field.
- Phone entry resolves to the person's account (teachers/staff and guardians), then continues with the exact same flow as email: password field if a password is set, set-your-password if it's their first login.
- Ambiguous phone: "This phone number matches multiple accounts, please log in with your email instead."
- Unknown phone: same "No account found" message as email today.
- Students are unaffected (no phone stored for them).
- Forgot password stays email-only. If the person got to the password step via phone, "Forgot password?" reveals an email input (pre-filled with the account email when known) and sends the reset there.

## How it works
Where the phone lives today: `profiles.phone` (staff/teachers, since the teachers table has no phone column of its own) and `student_guardians.phone` (guardians).

Backend (`src/lib/auth.functions.ts`):
- `lookupLogin` gains an `identifier` input and detects email vs phone.
  - Email: unchanged behaviour.
  - Phone: normalize to digits, keep the last 10 digits, and match against `profiles.phone` and `student_guardians.phone` (via the linked guardian profile). Collect distinct profile ids.
    - 0 matches -> `{ exists: false }`
    - 2+ matches -> `{ ambiguous: true }`
    - exactly 1 -> return `{ exists: true, passwordSet, email }` so the client continues with that account's real email.
- `setInitialPassword` stays keyed on email (the client already has the resolved email), so no auth-model change.

Frontend (`src/routes/auth.tsx`):
- Rename the first-step field to "Email or phone number", validate loosely (contains `@` -> email, otherwise digits), and store both the typed identifier and the resolved account email.
- Password/create steps show the resolved email (plus the phone that was used, for clarity) and keep using the email for `signInWithPassword` / `setInitialPassword`.
- "Forgot password?" now opens a small inline email field pre-filled with the resolved email; the reset call always uses that email.
- "Use a different email" becomes "Use a different email or phone".

No database migration and no SMS/OTP — this is a lookup convenience only, matching how the unverified email lookup works today.
