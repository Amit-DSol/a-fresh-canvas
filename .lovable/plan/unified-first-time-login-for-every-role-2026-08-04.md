# Unified first-time login for every role

## 1. No more invite emails at account creation

`findOrCreateUser` (used when adding teachers, students, guardians) stops calling
`inviteUserByEmail`. Instead it creates the auth user directly with the email already
confirmed and **no password**, then sets the profile's `password_set = false`.
Result: nothing is emailed when an account is created, for any role.

The existing "Resend invite" buttons on the Teachers and Students pages become
**"Reset first login"** — they simply flip `password_set` back to false so the person
can choose a new password on the login page. No email is sent.

## 2. One login page

`/parent-login` is deleted, along with the "Are you a parent? Sign in here" link on
`/auth`. `/auth` is the single entry point for admin, coordinator, teacher, student
and parent.

## 3. New two-step flow on `/auth`

```text
Step 1  Email
        |
        +-- no profile   -> "No account found for this email — contact your school admin"
        +-- password_set = true   -> Step 2a: password field -> normal sign-in
        +-- password_set = false  -> Step 2b: choose password + confirm
                                     -> password saved, password_set = true
                                     -> signed in immediately
```

A "Use a different email" link returns to step 1. The one-time principal/admin
signup card (shown only when no admin exists yet) stays as it is, as does
Google sign-in.

## 4. Forgot password

On the password step (step 2a) a "Forgot password?" link sends the standard
password-reset email to that address, with the link landing on `/set-password`.
Same behaviour for every role.

## 5. `/set-password`

Updated to handle the recovery-email session: it waits for Supabase to process the
recovery link (hash or `?code=` PKCE exchange), shows a clear expired-link message
otherwise, saves the new password, marks `password_set = true`, and sends the user
to their role's home page.

## Technical details

Schema: **no database migration needed** — reuses the existing `profiles.password_set`
column. No RLS changes.

New public (unauthenticated) server functions in `src/lib/auth.functions.ts`:
- `lookupLogin({ email })` -> `{ exists, passwordSet }`; returns only these two
  booleans, never names or other profile data.
- `setInitialPassword({ email, password })` -> refuses unless a profile exists and
  `password_set` is false; sets the auth password via the admin client, flips
  `password_set = true`. Password minimum 8 characters, enforced server-side too.

Files touched:
- `src/lib/auth.functions.ts` — the two new server functions above
- `src/lib/people.functions.ts` — `findOrCreateUser` creates the user directly;
  `resendInvite` becomes `resetFirstLogin`
- `src/routes/auth.tsx` — two-step email/password flow, forgot-password link,
  parent link removed
- `src/routes/set-password.tsx` — recovery-session handling
- `src/routes/parent-login.tsx` — deleted
- `src/routes/_authenticated/teachers.tsx`, `.../students.tsx` — button relabel
  and new function name
