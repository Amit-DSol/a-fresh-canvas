# School hub - 4

SCHOOL PORTAL — BUILD PROMPT

Single school · 5 roles · 5 modules · No fees

Paste this into Bolt.new / Lovable / Anything.com

Build a complete school management web portal from scratch for a single school. This is NOT a SaaS product. It is one portal for one school. The goal is simple: replace paper registers and WhatsApp chaos with one clean website that every stakeholder — admin, coordinators, teachers, parents, students — uses daily.

TECH STACK

React 18 + TypeScript

Tailwind CSS + shadcn/ui

Supabase (Auth + PostgreSQL + Row Level Security)

React Router v6

TanStack Query (React Query) for all data fetching

React Hook Form + Zod for all forms

Recharts for any charts

Sonner for toast notifications

jsPDF + html2canvas for report card PDF export

Lucide React for icons

Vite as bundler

DESIGN

Clean, professional, minimal. Built for people who are not tech-savvy. Think government portal meets modern SaaS — functional first, beautiful second.

Font: Inter (Google Fonts)

Primary color: #1E40AF (deep blue) — used for buttons, active states, links

Background: #F8FAFC (off-white page), #FFFFFF (cards)

Text: #0F172A (primary), #64748B (secondary/muted)

Success: #16A34A | Warning: #D97706 | Danger: #DC2626

Border: #E2E8F0 (all cards and inputs)

Border radius: 8px (inputs, badges), 12px (cards), 999px (pills)

All cards: white background, 1px solid #E2E8F0, border-radius 12px, padding 20px–24px

Sidebar navigation: white, 240px wide, collapses to icon-only on mobile

Top navbar: school name + logo on left, notification bell + user avatar dropdown on right

No gradients. No heavy shadows. Just clean flat surfaces.

Every data table: horizontal scroll on mobile, 25 rows per page with pagination

All forms: inline error messages under each field, required fields marked with *

Every successful action: green toast bottom-right ("Saved successfully")

Every delete: confirmation modal ("Are you sure? This cannot be undone.")

Empty states on every list: helpful message + icon + action button

Skeleton loaders on every page while data fetches (never a blank screen)

Fully responsive — works on a 375px wide phone browser

Dark mode toggle in navbar (saved to localStorage)

DATABASE SCHEMA

Create all tables in Supabase with proper foreign keys and Row Level Security.

-- SCHOOL (single row — this is one school's portal)
CREATE TABLE school_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  board TEXT,                          -- e.g. CBSE, ICSE, State Board
  academic_year TEXT DEFAULT '2025-26',
  principal_name TEXT,
  phone TEXT,
  email TEXT,
  primary_color TEXT DEFAULT '#1E40AF',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- USERS (one row per person, linked to Supabase auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (
    role IN ('admin', 'coordinator', 'teacher', 'parent', 'student')
  ),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- CLASSES (e.g. "Class 8 - A", "Class 10 - B")
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                  -- e.g. "Class 8"
  section TEXT NOT NULL,               -- e.g. "A"
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SUBJECTS (belong to a class)
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                  -- e.g. "Mathematics"
  code TEXT                            -- e.g. "MATH" (optional)
);

-- STUDENTS (linked to a profile and a class)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  roll_number TEXT,
  admission_number TEXT,
  date_of_birth DATE,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  address TEXT,
  parent_profile_id UUID REFERENCES profiles(id), -- the parent's profile
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TEACHERS (linked to a profile, assigned to classes and subjects)
CREATE TABLE teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  employee_id TEXT,
  is_coordinator BOOLEAN DEFAULT false, -- TRUE = this teacher is also a coordinator
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TEACHER-CLASS ASSIGNMENTS (which teacher handles which class)
CREATE TABLE teacher_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  is_class_teacher BOOLEAN DEFAULT false  -- class teacher = primary teacher for the class
);

-- TEACHER-SUBJECT ASSIGNMENTS (which teacher teaches which subject in which class)
CREATE TABLE teacher_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE
);

-- ATTENDANCE (one row per student per date)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'holiday')),
  marked_by UUID REFERENCES profiles(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date)             -- one record per student per day only
);

-- EXAMS (created by coordinator or admin — fully flexible)
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                  -- coordinator types freely e.g. "Unit Test 1"
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  academic_year TEXT,
  exam_date DATE,
  results_declared BOOLEAN DEFAULT false, -- flip to true to show results to parents/students
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- EXAM SUBJECTS (which subjects are in this exam, with max marks per subject)
CREATE TABLE exam_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  max_marks INTEGER NOT NULL DEFAULT 100
);

-- MARKS (teacher enters marks per student per subject per exam)
CREATE TABLE marks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  marks_obtained NUMERIC,
  grade TEXT,                          -- auto-calculated on save
  remarks TEXT,
  entered_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(exam_id, student_id, subject_id)
);

-- TIMETABLE (weekly schedule per class)
CREATE TABLE timetable (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES teachers(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 6), -- 1=Mon 6=Sat
  period_number INTEGER NOT NULL CHECK (period_number BETWEEN 1 AND 9),
  start_time TIME,
  end_time TIME,
  UNIQUE(class_id, day_of_week, period_number)
);

-- HOMEWORK (teachers post per class per subject)
CREATE TABLE homework (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id),
  teacher_id UUID REFERENCES teachers(id),
  description TEXT NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- NOTICES (school-wide announcements)
CREATE TABLE notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  target_roles TEXT[] DEFAULT '{all}',  -- ['all'] or ['parents','students'] etc
  is_pinned BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- MESSAGES (1-to-1 parent to class teacher only)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id),
  recipient_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  parent_message_id UUID REFERENCES messages(id), -- for threading replies
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IN-APP NOTIFICATIONS LOG
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID REFERENCES profiles(id),
  title TEXT,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);


ROW LEVEL SECURITY RULES

Apply RLS on every table. Core rules:

profiles: users can read their own row. Admin and coordinator can read all rows.

students: admin and coordinator read/write all. Teacher reads students in their assigned classes. Parent reads only their own child (where parent_profile_id = auth.uid()). Student reads only their own row.

attendance: admin and coordinator read all. Teacher reads/writes attendance for their assigned classes only. Parent reads their child's attendance only. Student reads their own attendance only.

exams and exam_subjects: admin and coordinator create/edit. Teachers read exams for their assigned classes. Parents and students read exams where results_declared = true.

marks: admin and coordinator read all. Teacher reads/writes marks for their assigned subjects only. Parent reads their child's marks where results_declared = true. Student reads own marks where results_declared = true.

timetable: admin and coordinator write. Everyone reads.

homework: admin, coordinator, and teacher of that class write. Students in that class and their parents read.

notices: admin and coordinator write. Everyone reads notices targeted to their role.

messages: sender and recipient can read. Only sender can create.

USER ROLES — COMPLETE BEHAVIOUR

Role 1: Admin (Principal)

First user to sign up becomes Admin automatically.

Can see everything across the whole school.

Sets up the school profile (name, logo, board, academic year) via onboarding wizard.

Creates classes and sections (e.g. "Class 8 - A").

Adds subjects per class.

Invites coordinators and teachers by email.

Cannot mark attendance or enter marks (that's teachers' job).

Views all reports and dashboards.

Can post school-wide notices.

Can declare exam results (or delegate to coordinator).

Role 2: Coordinator (is_coordinator = true on teachers table)

A coordinator IS a teacher — they teach subjects too.

Extra powers on top of teacher:

Add new students to the system (fill profile + student details).

Create exams: type the exam name, choose the class, tick subjects, set max marks per subject, set date.

Manage timetable for their assigned classes.

Declare results (flip results_declared = true on an exam).

View all students in their assigned classes with full details.

Gets both a teacher view AND coordinator controls in the sidebar.

Role 3: Teacher

Assigned to one or more classes and one or more subjects.

Every morning: mark attendance for their class (one assigned class per teacher).

After exams: enter marks for their subjects only in any declared exam.

Post homework for their class and subjects.

View messages from parents of their students. Reply to them.

View notices, timetable, and student list (read-only) for their class.

Role 4: Parent

Linked to exactly one student (their child).

Sees their child's: attendance record, exam marks (only after results declared), timetable, today's homework, and notices.

Can message their child's class teacher (1-to-1 only).

Cannot see any other student's data. Ever.

Role 5: Student

Sees their own: attendance, marks (only after results declared), timetable for their class, homework for their class, and notices.

Read-only. Cannot post, edit, or message anyone.

PAGES — COMPLETE LIST WITH BEHAVIOUR

PUBLIC PAGES (no login needed)

/ — Landing Page

Header: school logo + name on left, "Login" button on right.

Hero: bold headline "Everything your school needs, in one place." Subtext: "Attendance. Marks. Timetable. Homework. All in one portal — for teachers, parents, and students." Single CTA: "Login to the Portal" (goes to /auth).

Features section: 5 cards — Attendance Tracking, Flexible Exams, Class Timetable, Homework & Notices, Parent-Teacher Messaging.

Footer: school name, academic year, "Powered by EduPortal".

This page pulls school name and logo from school_settings table.

/auth — Login Page

Clean centered card. School logo at top.

Email + password fields.

"Sign in with Google" button.

"Forgot password" link (sends reset email via Supabase).

No signup option visible — accounts are created by admin/coordinator only. Exception: first ever login creates the admin account (signup flow only for first user).

After login, redirect based on role:

Admin → /dashboard

Coordinator → /dashboard

Teacher → /dashboard

Parent → /parent

Student → /student

ONBOARDING WIZARD (admin only, shown once after first login)

Full-screen step-by-step wizard. Cannot be skipped. Progress bar at top. 3 steps:

Step 1 — School Profile Fields: School name, Logo URL (paste link), Address, City, Board (CBSE/ICSE/State Board/IB/Other dropdown), Academic year (text, e.g. 2025-26), Principal name, Phone, Email. Save to school_settings.

Step 2 — Create Classes Dynamic table. Each row: class name (e.g. "Class 8") + section (e.g. "A" "B" "C"). "Add row" button. User adds as many classes as their school has. Quick note: "You can add subjects after setup."

Step 3 — You're ready! "Your portal is set up. Here's what to do next:"

"Invite a coordinator" → button copies an invite link.

"Add subjects to classes" → goes to /settings/subjects.

"Go to Dashboard" → goes to /dashboard.

ADMIN + COORDINATOR DASHBOARD (/dashboard)

Sidebar navigation (role-based — coordinators see extra items):

Dashboard

Students

Teachers (admin only)

Attendance

Exams & Marks

Timetable

Homework

Notices

Messages (coordinator sees all threads, admin sees read-only)

Settings (admin only)

Top stats row (4 cards):

Total Students

Total Teachers

Attendance Today % (green if >90%, yellow if 75–90%, red if below 75%)

Exams This Month

Dashboard widgets:

Attendance chart: bar chart of last 7 school days showing daily attendance %

Absent today: list of student names absent today with their class

Recent notices: last 3 notices posted

Upcoming exams: next 3 exams across all classes

Low attendance alert: students below 75% this month (red badges)

STUDENTS PAGE (/students) — Admin + Coordinator

Table columns: Photo/Avatar | Full Name | Class | Roll No | Admission No | Parent Name | Parent Phone | Status (Active/Inactive)

Top controls:

Search bar (searches name, roll number, admission number)

Filter dropdown: by class, by section

"Add Student" button (coordinator and admin only)

Export CSV button

"Add Student" opens a slide-over panel (not a separate page): Fields:

Full Name *

Email * (used for their login)

Phone

Date of Birth (date picker)

Gender (Male/Female/Other)

Address

Class * (dropdown of existing classes)

Roll Number

Admission Number

Parent's Name *

Parent's Email * (used for parent login — system creates parent account automatically)

Parent's Phone

On save: creates a profile for the student, creates a profile for the parent, links them together, sends login credentials to both emails.

Click any student row → Student Detail Page:

Left: student card (photo, name, class, roll number, admission number, DOB, gender, address)

Right tabs:

Attendance: monthly calendar heatmap (green=present, red=absent, gray=holiday) Below: summary stats — present days, absent days, attendance %

Marks: table of all exams, subjects, marks, grade — filtered to this student

Homework: list of all homework posted for their class

Parent: parent name, email, phone. "Edit" button.

Bottom: "Edit Student" button | "Deactivate" button (with confirmation modal)

TEACHERS PAGE (/teachers) — Admin only

Table: Name | Employee ID | Assigned Classes | Is Coordinator | Status

"Add Teacher" button → slide-over panel: Fields:

Full Name *

Email * (for login)

Phone

Employee ID

Is Coordinator? (toggle — if yes, this teacher gets coordinator powers)

Assign to Classes (multi-select from existing classes)

Assign subjects (for each selected class, pick which subjects they teach)

On save: creates profile with role = teacher (or coordinator if toggled), sends login email.

Click teacher → Teacher Detail:

Profile info

Assigned classes and subjects

"Edit" | "Deactivate" buttons

ATTENDANCE PAGE (/attendance)

Teacher / Coordinator View:

Select class at top (dropdown — only shows teacher's assigned classes)

Date picker (default: today. Can change to yesterday if forgot)

Student list: photo | roll number | name | 3 buttons: P (present) A (absent) L (late)

Buttons are toggle — clicking highlights the selection

"Mark Holiday" button (marks all as holiday for selected date and class)

"Mark All Present" shortcut button

Big "Save Attendance" button at bottom

If attendance already marked for this date: shows existing data and allows editing

Toast on save: "Attendance saved for Class 8-A — 35 present, 2 absent"

Admin / Coordinator Report View (tab: "Reports"):

Filter: class + date range

Attendance summary table: student name | total days | present | absent | late | %

Color code % column: green ≥90%, amber 75–89%, red <75%

"Export CSV" button

Bar chart: daily attendance trend for selected class over selected period

EXAMS & MARKS PAGE (/exams)

Coordinator / Admin — Exam List View:

Table: Exam Name | Class | Date | Subjects | Results Declared | Actions

"Create Exam" button → slide-over panel with this form:

Exam Name * (free text input — type anything: "Unit Test 1", "Pre-Board", "SA1", etc.)

Class * (dropdown of all classes)

Exam Date (date picker)

Subjects in this exam: Checklist of all subjects for the selected class. Checking a subject reveals a "Max Marks" number input next to it. Example: [✓] Mathematics — Max Marks: [50] [✓] Science — Max Marks: [50] [ ] English (unchecked = not in this exam)

"Create Exam" save button

After creation: exam appears in list with status "Results Not Declared". Action buttons: "Enter Marks" | "Declare Results" | "Delete"

"Declare Results" → confirmation modal: "Once declared, parents and students will be able to see results. Are you sure?" → flips results_declared = true.

Teacher — Marks Entry View:

Teacher sees only exams for their assigned classes and subjects.

Clicking "Enter Marks" → marks entry table:

One tab per subject they teach in this exam.

Table: Roll No | Student Name | Marks Obtained (input field) | Grade (auto-filled) | Remarks (optional text)

Max marks shown as a label above the input: "Out of 50"

Grade auto-calculates on input: ≥90% = A+, ≥80% = A, ≥70% = B+, ≥60% = B, ≥50% = C, ≥35% = D, <35% = F

"Save Marks" button saves all rows at once.

If marks already saved: shows existing values and allows editing.

Report Card View (/report-card/:studentId/:examId):

Printable page layout.

School header: logo + name + address + board + academic year.

Student info: name, class, roll number, admission number.

Marks table: Rows = subjects. Columns = Subject | Max Marks | Marks Obtained | Percentage | Grade.

Summary row: Total | Total Max | Overall % | Overall Grade.

Attendance summary: Days Present / Total Days / Attendance %.

"Print" button → triggers window.print(). Page is styled for A4 print.

"Download PDF" button → generates PDF using jsPDF + html2canvas.

Teachers can add a "Remarks" text field that saves to the database.

Admin / Coordinator — Results Overview:

Dropdown: select exam.

Table of all students in that class with total marks and grade.

Class average shown at top.

Sort by: name, marks (highest to lowest).

TIMETABLE PAGE (/timetable)

Coordinator / Admin — Edit Mode:

Class selector dropdown at top.

Weekly grid: rows = Periods 1–9 (with time labels e.g. 8:00–8:45), columns = Mon–Sat.

Each cell: click to edit → small dropdown appears with subject + teacher options. Only teachers assigned to that class appear in the dropdown.

"Save Timetable" button saves all changes.

"Add Period" button → modal to add a new period row with start and end time.

Teacher View:

Shows their personal weekly schedule (all classes they teach).

Today's periods highlighted with a blue border.

"Today" summary card at top: list of today's periods in order.

Student / Parent View:

Read-only weekly grid for their class.

Today highlighted.

Clean, no edit buttons.

HOMEWORK PAGE (/homework)

Teacher / Coordinator View:

"Post Homework" form at top:

Class * (dropdown — only their assigned classes)

Subject * (dropdown — only their assigned subjects for that class)

Description * (textarea — what the homework is)

Date (default: today)

Due Date (date picker)

"Post" button

List of all homework they've posted: Table: Class | Subject | Description | Date | Due Date | Delete button

Filter: by class, by date

Student / Parent View:

List of homework for the student's class.

Sorted by due date (soonest first).

Status badge: "Due today" (yellow), "Overdue" (red), "Upcoming" (gray).

Filter tabs: All | Pending | Overdue.

Each row: Subject | Description | Posted Date | Due Date.

NOTICES PAGE (/notices)

Admin / Coordinator — Post + View:

"Post Notice" button → slide-over panel:

Title *

Body * (textarea with basic formatting)

Audience (dropdown): All | Teachers & Coordinators | Parents & Students | Students Only | Parents Only

Pin to top? (toggle)

"Post" button

Notice list: pinned notices first (with pin icon), then sorted by newest.

Each notice card: title, body preview, audience badge, date, "Delete" button.

Teacher / Parent / Student View:

Read-only list of notices relevant to their role.

Pinned notices appear first with a highlighted border.

Click notice → full text in a modal.

MESSAGES PAGE (/messages)

Parent View:

One conversation thread: parent ↔ their child's class teacher.

If no conversation yet: "Send a message to [Teacher Name]" with an empty state.

Chat-style UI: messages bubbled, timestamps shown.

Input box + send button at bottom.

Character limit: 500 per message.

Teacher / Coordinator View:

Left sidebar: list of all parent conversations (parent name, student name, last message preview, time, unread count badge).

Right panel: selected conversation chat thread.

Reply input at bottom.

Unread badge count on "Messages" in the sidebar nav.

Admin View:

Read-only view of all conversations.

Can see all threads but cannot send.

TEACHER DASHBOARD (/dashboard) — Teacher-specific view

Sidebar items for teacher:

Dashboard

My Class (students in their assigned class)

Attendance (mark attendance)

Marks (enter marks for their subjects)

Timetable

Homework

Notices

Messages

Teacher dashboard widgets:

Today's timetable (periods for today)

Quick attendance widget: "Attendance not marked today for Class 8-A" → button to mark

Unread messages count

Homework posted this week

Upcoming exams for their class

PARENT PORTAL (/parent) — Parent-specific view

Clean, simple. Single child focus.

Top card: child's name, class, roll number, school name.

Four tab sections:

Tab 1 — Overview:

Attendance this month: circular progress indicator showing % present.

Last exam result: subject-wise marks in a mini table.

Today's homework: subject + description for each homework due.

Latest notice from school.

Tab 2 — Attendance:

Monthly calendar view: green dots (present), red dots (absent), gray (holiday).

Summary: Total school days | Present | Absent | Attendance %.

Month picker to go back.

Tab 3 — Marks:

Dropdown: select exam (only shows exams where results_declared = true).

Table: Subject | Max Marks | Marks Obtained | Percentage | Grade.

"Download Report Card" button (PDF).

Tab 4 — Messages:

Chat interface with class teacher.

Same as the Messages page but embedded here as a tab.

STUDENT PORTAL (/student) — Student-specific view

Sidebar items:

Home (dashboard)

My Timetable

Homework

My Marks

Notices

Student dashboard:

Today's class schedule (today's timetable periods).

Homework due this week (list by subject).

Latest marks (most recent declared exam, mini table).

Latest notice.

All views are read-only. No editing, no messaging.

SETTINGS PAGE (/settings) — Admin only

Tabs:

School Profile: Edit all school_settings fields. Upload logo. Change primary color via color picker. "Save changes" button.

Classes & Subjects: List of all classes. For each class:

Edit class name/section.

Add/remove subjects.

Delete class (with warning: deletes all linked data). "Add Class" button.

Academic Year: Change the current academic year (e.g. "2026-27"). Warning: "Changing this affects all exams and attendance records."

User Management: Table of all users: name, email, role, status. Actions: Deactivate, Change Role, Resend Login Email.

NAVIGATION — ROLE BASED SIDEBAR ITEMS

Page Admin Coordinator Teacher Parent Student Dashboard ✅ ✅ ✅ ✅ ✅ Students ✅ ✅ 👁 only ❌ ❌ Teachers ✅ ❌ ❌ ❌ ❌ Attendance ✅ ✅ ✅ 👁 own 👁 own Exams & Marks ✅ ✅ ✅ 👁 own 👁 own Timetable ✅ ✅ 👁 own 👁 own 👁 own Homework ✅ ✅ ✅ 👁 own 👁 own Notices ✅ ✅ 👁 👁 👁 Messages 👁 ✅ ✅ ✅ ❌ Settings ✅ ❌ ❌ ❌ ❌

(✅ = full access, 👁 = read-only or own data only, ❌ = no access)

IMPORTANT BEHAVIOURS

When a coordinator adds a student, the system automatically creates:

A profile with role = 'student'

A student record linked to that profile

A profile for the parent with role = 'parent'

Both get a welcome email with their login link and temporary password via Supabase Auth.

Exam creation is fully freeform:

Exam name = free text (not a dropdown, not a fixed list)

Subjects = checkbox list pulled from the selected class's subjects

Max marks = individual number input per subject (can be different per subject)

This means "Unit Test 1" for Class 8 can have Math (50 marks) and Science (50 marks) while "Half Yearly" for the same class has all 6 subjects at 100 marks each.

Results are hidden from parents and students until coordinator/admin explicitly clicks "Declare Results" on an exam. Before that, marks exist in the database but are not visible to parent/student.

Attendance can only be marked once per class per date. If a teacher tries to mark attendance for a date that's already marked, they see the existing data in edit mode.

The "Class Teacher" flag (is_class_teacher in teacher_classes) determines:

Who parents can message (they message the class teacher of their child's class)

Whose attendance marking is "primary" for that class

A coordinator is stored as a teacher with is_coordinator = true. Their sidebar shows both teacher features AND coordinator features. No separate login needed.

All dates display in DD/MM/YYYY format throughout the app.

Marks input validation: cannot be greater than max_marks for that subject. Shows inline error if teacher tries to save more than max.

BUILD ORDER

Follow this exact order. Each step must work end-to-end before moving to the next:

Supabase setup — all tables, RLS policies, foreign keys

Auth — login, Google OAuth, password reset, role-based redirects

Onboarding wizard — 3 steps, saves to school_settings and creates first classes

App shell — sidebar (role-based), top navbar, breadcrumbs, routing

Settings page — school profile, classes & subjects, user management

Students module — list, add student (creates parent account too), student detail

Teachers module — list, add teacher (with coordinator toggle), assign classes/subjects

Attendance module — marking UI for teachers, reports for admin, view for parent/student

Exams & Marks module — create exam (flexible form), enter marks, declare results, report card

Timetable module — coordinator edits, everyone views

Homework module — teacher posts, student/parent views

Notices module — admin/coordinator posts, everyone views

Messages module — parent to teacher, teacher replies, admin reads

Landing page (public /)

Parent portal (/parent) — tabbed view

Student portal (/student) — dashboard

Polish pass — empty states, skeleton loaders, mobile responsiveness, dark mode

DO NOT BUILD

Fee management (not needed yet)

Library module

Transport module

HR / payroll

Multi-school / multi-tenant support

Biometric integration

Public admission enquiry form

Any analytics beyond the dashboard widgets described above

Keep it focused. These 5 modules built perfectly are worth more than 15 modules built badly. , also do it step wise , make sure it doesnt fail

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8cc984b0-5fbb-4731-8517-b727c714aedb).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
