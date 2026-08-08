# Stage 5 — Lock marks after results are declared

## What changes

Once a term's results are declared, teachers can still see marks but can no longer change them. Admins and coordinators keep full edit rights at all times.

## 1. Database access rules

Replace the two teacher "manage marks" policies on the marks table so they only apply when the exam term is **not** declared:

- Class teacher manage marks: existing class-teacher check AND `NOT exams.results_declared`
- Subject teacher manage marks: existing subject-teacher check AND `NOT exams.results_declared`

Both read policies (class teacher, subject teacher) stay exactly as they are, so declared results remain visible. Admin/coordinator policies untouched. Parent/student read-if-declared policies untouched.

## 2. Server-side guard

In `src/lib/exams.functions.ts`, both `saveMarks` and `saveStudentMarks` will:

- look up the exam term for the papers being saved
- if the term is declared and the caller is not admin/coordinator, throw:
  `Results have been declared for this exam — contact admin to make changes`

## 3. Read-only UI

In `src/routes/_authenticated/exams.tsx`:

- Whole-class marks table: when the term is declared and the user is not admin/coordinator, disable every input and the save button, and show a small "Results declared — read only" notice.
- StudentResultsDialog: same treatment — inputs and "Save all subjects" disabled, same notice.

Admin/coordinator see no change anywhere.

## Stage 6 check

Stage 4 already renders "last edited by [name], [date]" per row in the student results dialog. The only gap is the whole-class per-subject table, which does not show editor info yet — I can add the same line there while doing Stage 5 if you want it.
