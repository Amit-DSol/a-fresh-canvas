# Part B — Bulk marks import for exam terms

A third way to enter marks, alongside the existing per-subject table and the student-by-student dialog. Both stay untouched.

## Entry point

On the exam term detail page, a new "Bulk marks (CSV)" button opens a dialog. Inside, a class picker lists only classes the user may enter marks for (admin/coordinator: every class in the term; class teacher: only their own class) — reusing the existing `listExamClassesForEntry` permission rule.

## 1. Template download

Per selected class, "Download marks template" produces:

```text
Roll No,Student Name,Mathematics (Max 100),Science (Max 100),English (Max 80)
1,Aarav Sharma,78,,65
2,Diya Verma,,,
```

- One column per subject scheduled for that class in this term.
- Existing marks are pre-filled, so re-downloading shows saved progress.
- Data comes from a new server function `getMarksSheetForClass({ exam_id, class_id })` returning students (id, roll, name), papers (paper_id, subject, max_marks) and the current marks matrix.

## 2. Upload + preview

CSV is parsed client-side with papaparse (already installed for student import).

- Each subject column header is matched back to a scheduled paper by subject name (the "(Max n)" suffix is ignored). Unmatched columns are flagged and skipped.
- Each row is matched to a student by Roll No. Unrecognized roll numbers are flagged and skipped.
- Preview table shows every row with per-cell validation:
  - non-numeric value → error
  - value above the subject's max marks → error
  - value below 0 → error
  - blank → left untouched, shown as "—"
- Summary bar above the preview: rows ready, rows with problems, columns skipped. Commit button is disabled while any blocking problem remains.

## 3. Commit

`importMarks({ exam_id, class_id, entries })`:

- Re-verifies the caller's permission on the class.
- Re-checks the results-declared lock: if declared and the caller is not admin/coordinator, the whole import is rejected with the existing message ("Results have been declared for this exam — contact admin to make changes"). Nothing is written.
- Re-validates each entry server-side against the paper's max marks; invalid entries are returned as skipped rows rather than written.
- Only cells with a value are written. Blank cells are never sent, so existing marks are never blanked out.
- Writes in one batched upsert on `marks` with `onConflict: "exam_paper_id,student_id"`, setting `entered_by` to the caller — identical to the existing save paths.
- Returns `{ created, updated, skipped: [{ roll, subject, reason }] }` (created vs updated determined by reading the existing marks for those papers before the upsert).

## 4. Post-import summary

The dialog switches to a result view: counts of marks created and updated, plus a table of skipped rows with the specific reason. Queries `exams`, `exams-pending` and the marks sheet are invalidated so the other two entry views show the imported values immediately.

## Files touched

- `src/lib/exams.functions.ts` — `getMarksSheetForClass`, `importMarks`.
- `src/components/import-marks-dialog.tsx` — new dialog (template download, parse, preview, commit, summary).
- `src/routes/_authenticated/exams.tsx` — one new button in `ExamDetail` that opens the dialog.

No database changes.    
I got this error adding a teacher: "insert or update on table 'teachers' 

violates foreign key constraint 'teachers_profile_id_fkey'". This is the 

first time I've tried adding a teacher since the invite-email removal / 

direct-auth-user-creation change. Before patching anything, please 

investigate and report back:

1. In findOrCreateUser (or wherever teacher accounts are now created since 

   the login overhaul), confirm exactly how the auth user is created and 

   whether the code waits for/confirms a matching profiles row exists before 

   using that id anywhere else (like inserting into teachers).

2. Check whether the profiles table's creation is still handled by a 

   database trigger on auth.users (handle_new_user or similar) — if so, 

   confirm that trigger still fires correctly for users created via the 

   admin createUser call in the new flow, the same way it did with the old 

   inviteUserByEmail call.

3. Specifically check the email [amitahirwar2009@gmail.com](mailto:amitahirwar2009@gmail.com) — does an auth 

   user exist for it with no matching profiles row (orphaned)? If so, that 

   confirms the bug and this leftover row needs cleaning up too, not just 

   the code path fixed going forward.

4. Report what you find — don't apply a fix yet, I want to see the actual 

   cause first, especially since this could affect every account created 

   since the login overhaul, not just this one attempt.