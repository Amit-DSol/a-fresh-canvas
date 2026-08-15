# Timetable/exam info for students + Analytics for staff

## Stage 1 — Timetable + Upcoming Exams on the student page

On the student detail page (`/student`, used by students for themselves and parents for a linked child):

- **Weekly Timetable** card: the student's class schedule, grouped by day (Mon–Sat) with period number, subject and teacher name. Data comes from the existing timetable lookup filtered by the student's class.
- **Upcoming Exams** card: future exam papers for that class grouped by exam term, showing subject, date, time and room.
- Both sections load only when the student's class is known, are read-only, and work identically for a parent viewing a child.

Technical notes:
- `myStudentInfo` currently omits `class_id` from its return; add it so the client can scope both queries.
- The existing `listUpcomingExams` and `listExamSchedule` already filter `exam_papers.class_id` directly, so they match the current multi-class exam schema — no rework needed, just wiring. `listTimetable` already accepts `class_id`.
- No new server functions for this stage.

## Stage 2 — Analytics page: attendance

New `/analytics` route + nav item, visible to admin, coordinator and teacher.

- **Attendance % by class** over a selectable date range: horizontal bars per class with present/marked counts and percentage.
- **Chronic absentees**: students below a configurable threshold (default 75%) in that range, with class, roll, present/marked and percentage.
- **CSV export** buttons for both tables, using the same blob-download pattern as the attendance report.
- Scoping enforced server-side: admin/coordinator see all classes; a class teacher sees only classes where they are class teacher; a subject teacher with no class-teacher assignment sees nothing (empty state with an explanatory message).

Technical notes:
- New `src/lib/analytics.functions.ts` with `attendanceByClass` and `chronicAbsentees` server functions (auth middleware, role-scoped class list computed on the server).

## Stage 3 — Analytics page: academic performance

Added as a second area of the same page, driven by an exam-term selector.

- **Class and subject averages** for the selected term (average % of max marks).
- **Top / bottom performers**, count configurable (default 5), per class, by total percentage.
- **Pass/fail distribution** per class using a configurable pass percentage (default 33%).
- **CSV export** for each of these views.
- Scoping: admin/coordinator see everything; class teacher sees their own class across subjects; a subject teacher sees only their subject's data in the classes they teach it in.

Technical notes:
- Extends `analytics.functions.ts` with `examTermsForAnalytics`, `performanceByClass` (class + subject averages, pass/fail) and `topBottomPerformers`, all reading `marks` joined to `exam_papers` and scoping by the caller's role/assignments.
- Charts stay simple (CSS bars), no new chart dependency.

## Out of scope for this round
Staff-oversight analytics (homework compliance, teacher activity) and the unified reports page.
