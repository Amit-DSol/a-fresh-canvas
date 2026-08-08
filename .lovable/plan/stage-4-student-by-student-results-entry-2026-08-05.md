# Stage 4 — Student-by-student results entry

No database changes. Uses existing `exam_papers`, `marks`, `students`, `profiles`.

## New server functions (`src/lib/exams.functions.ts`)

1. `listExamClassesForEntry({ exam_id })`
   - Returns the term's classes the caller may enter results for.
   - admin / coordinator: every class in `exam_classes`.
   - class teacher: only classes where `teacher_classes.is_class_teacher` is true.
   - anyone else: empty list.

2. `listStudentResultSheet({ exam_id, class_id })`
   - Verifies the caller is allowed on that class (same rule as above).
   - Returns the class's students (id, roll, name) and one row per scheduled paper:
     `{ paper_id, subject, max_marks, paper_date }`.

3. `listStudentMarks({ exam_id, class_id, student_id })`
   - For the chosen student, returns per paper: `marks_obtained`, `grade`, `remarks`,
     `updated_at`, and the editor's name resolved from `entered_by` → `profiles.full_name`.

4. `saveStudentMarks({ entries: [{ exam_paper_id, student_id, marks_obtained, grade, remarks }] })`
   - Single upsert on `marks` with `onConflict: "exam_paper_id,student_id"`, setting
     `entered_by = caller`, mirroring the existing `saveMarks` behaviour.

## UI (`src/routes/_authenticated/exams.tsx`)

New `StudentResultsDialog` component:

- Class picker (only the allowed classes — a class teacher sees only their own).
- Student picker (roll number + name) for the chosen class.
- Table of every scheduled paper for that class in the term:

```text
Subject      Max   Marks   Grade   Remarks     Last edited
Maths        100   [ 78 ]  [ A ]   [        ]  Amit Ahirwar, Aug 3, 2026
Science      100   [    ]  [   ]   [        ]  —
```

- One "Save all subjects" button commits every row in a single call, then invalidates
  `exams`, `exams-pending`, and the sheet query.

Entry points:
- Clicking a class row in the Stage 3 "Pending results" card opens the dialog with that
  term + class preselected.
- A "Student results" button on the exam term detail page opens it for that term.

## Unchanged

The existing per-paper whole-class marks table (`MarksEntry`) and subject-teacher flow stay
exactly as they are. No results-declared locking in this stage.

## Files touched

- `src/lib/exams.functions.ts` — four new server functions.
- `src/routes/_authenticated/exams.tsx` — new dialog, pending-card row click, detail button.
