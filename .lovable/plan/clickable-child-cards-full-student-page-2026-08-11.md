# Clickable child cards → full student page

## What changes

1. **Parent Portal cards become links.** Each child card (Sangeeta, Amit kumar) gets a clickable header that opens the full student page for that child. The condensed summary already on the card stays as-is.

2. **Student page works for parents too.** The student page accepts an optional child id in the URL. When present, it loads that child's data instead of the signed-in user's. Access is verified on the server using the existing parent-of-student check, so a parent can only open a child actually linked to them.

3. **Clear denial message.** If a parent (or anyone else) puts a student id in the URL they aren't allowed to view, the page shows an explicit "Access denied — this student isn't linked to your account" card with a link back, instead of an empty page.

4. **Read-only.** No edit controls are added. The page keeps exactly the same read-only widgets: profile header, attendance stats + calendar, homework, results, report-card PDF.

5. **Back link.** When viewing a child's page, a "Back to Parent Portal" button appears at the top. It is hidden when a student views their own page.

## Technical details

- `src/lib/student.functions.ts`: extend `myStudentInfo` to take an optional `student_id`. When provided, the handler resolves the student row by id and authorizes via `is_parent_of_student(auth.uid(), student_id)` RPC (falling back to "it's my own row"). Unauthorized → returns `{ denied: true }` so the UI can render a message rather than a blank state. Also returns the student's `profile_id` so the child-scoped data queries can be made.
- `src/routes/_authenticated/student.tsx`: add a validated `?student=<uuid>` search param. When set, pass `student_profile_id` to the existing `myAttendance`, `myResults`, and `myClassHomework` server functions (they already support that argument and are RLS-guarded). Render the access-denied card when the info query reports denial. Show the back button only when the search param is present.
- `src/routes/_authenticated/parent.tsx`: wrap each child's card title in a `<Link to="/student" search={{ student: child.id }}>`, with hover styling and a chevron affordance.

No database migration and no new tables; the guardian-path RLS policies added earlier already cover the reads.
