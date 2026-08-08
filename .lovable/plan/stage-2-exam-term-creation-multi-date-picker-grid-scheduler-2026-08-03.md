# Stage 2 — Exam term creation: multi-date picker, grid scheduler, CSV export

No database changes. Schema from Stage 1 (`exam_dates`, `exam_classes`, `exam_papers.class_id`) already supports everything here.

## 1. Multi-date picker (Create exam term dialog)

Replace the "Starts on / Ends on" inputs with a shadcn `Calendar` in `mode="multiple"`:

- Click a day to add it, click again to remove it.
- Below the calendar, the selected dates render as removable chips sorted ascending ("Aug 2, 2026 ✕").
- Dates are sent to the existing `createExam({ name, dates, class_ids })` server function, which already stores them in `exam_dates`.
- Class multi-select stays exactly as-is.

## 2. Grid scheduler

New component `ScheduleGrid` in the exams page:

```text
             | 1-A       | 1-B       | 10-Sci-A  |
Aug 2, 2026  | [Math  v] | [–     v] | [Phys  v] |
Aug 5, 2026  | [–     v] | [Eng   v] | [Chem  v] |
```

- Rows = the term's `exam_dates`, ascending.
- Columns = the term's `exam_classes`, sorted by grade number then section.
- Each cell is a dropdown of that column's class's subjects plus a "–" option, prefilled from any existing paper for that (date, class).
- "Save schedule" commits the whole grid in one call.

Opened automatically right after creating a term, and reachable any time from the term detail page via a "Schedule grid" button. The existing paper table stays below it so times, room, and max marks remain individually editable.

### Server function (new, in `src/lib/exams.functions.ts`)

`saveSchedule({ exam_id, cells: [{ class_id, paper_date, subject_id | null }] })`, admin/coordinator gated:

- `subject_id` set → insert or update the paper for that (exam, class, date) with `max_marks` defaulting to 100 (preserves existing max_marks/time/room when updating).
- `subject_id` null → delete any existing paper for that cell.
- Skips "–" cells that had no paper, so no empty rows get created.

Constraint fit: `UNIQUE(exam_id, class_id, paper_date)` means exactly one paper per cell, matching the grid one-to-one.

## 3. CSV export

"Download schedule as CSV" button on the term detail page — client-side, no server call. Same grid shape: first row = class names, first column = dates, cells = subject name or "–". Filename `<term-name>-schedule.csv`.

## Files touched

- `src/lib/exams.functions.ts` — add `saveSchedule`.
- `src/routes/_authenticated/exams.tsx` — calendar picker + chips, `ScheduleGrid` component, CSV button, wire post-create navigation.
