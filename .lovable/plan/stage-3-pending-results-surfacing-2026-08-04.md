# Stage 3 — Pending results surfacing

No database changes. Everything reads from existing `exams`, `exam_dates`, `exam_papers`, `marks`, and `teacher_classes`.

## What counts as "pending"

An exam term is pending when its latest `exam_dates` date is in the past and `results_declared` is still false.

## New server function: `listPendingResults`

Added to `src/lib/exams.functions.ts`, auth-gated like the rest.

- Loads exam terms with their dates, classes, and papers; keeps only terms whose last date < today and `results_declared = false`.
- For each remaining term, builds a per-class row: total scheduled papers for that class, and how many of those papers have at least one row in `marks`.
- Scoping:
  - admin / coordinator — every class in the term.
  - class teacher — only classes where they are flagged `is_class_teacher`; terms with none of their classes drop out entirely.
  - anyone else — empty list.
- Returns `[{ exam_id, exam_name, last_date, classes: [{ class_id, label, total, entered }] }]`.

## UI on the Exams page

`src/routes/_authenticated/exams.tsx`:

1. **Pending results card** above the exam-term list (full width), shown only when the list is non-empty. Each term shows its name and end date, then one line per class:

```text
Half Yearly · ended Aug 2, 2026
  10-A   6 of 8 subjects entered   [64%]
  10-B   8 of 8 subjects entered   Complete
```

Incomplete classes get a warning-toned badge, complete ones a neutral "Complete" badge. Clicking a term selects it in the existing detail pane.

2. **Badge in the term list** — pending terms get a small "Pending results" badge next to the existing "Declared" badge, so the state is visible while browsing.

Nothing else on the page changes; marks entry, scheduling grid, and CSV export stay as they are.

## Files touched

- `src/lib/exams.functions.ts` — add `listPendingResults`.
- `src/routes/_authenticated/exams.tsx` — pending card, badge, query wiring.
