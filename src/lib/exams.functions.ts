import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hasAnyRole(supabase: any, userId: string, roles: string[]) {
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return true;
  }
  return false;
}

async function assertAdminOrCoordinator(supabase: any, userId: string) {
  if (!(await hasAnyRole(supabase, userId, ["admin", "coordinator"])))
    throw new Error("Forbidden");
}

export const RESULTS_LOCKED_MESSAGE =
  "Results have been declared for this exam — contact admin to make changes";

async function assertNotLocked(supabase: any, userId: string, paperIds: string[]) {
  if (!paperIds.length) return;
  if (await hasAnyRole(supabase, userId, ["admin", "coordinator"])) return;
  const { data } = await supabase
    .from("exam_papers")
    .select("id, exams(results_declared)")
    .in("id", paperIds);
  if ((data ?? []).some((p: any) => p.exams?.results_declared))
    throw new Error(RESULTS_LOCKED_MESSAGE);
}

function sortDates(dates: string[]) {
  return Array.from(new Set(dates)).sort();
}

/* ---------------- EXAM TERMS ---------------- */

export const listExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await (context.supabase as any)
      .from("exams")
      .select(
        "id, name, academic_year, starts_on, ends_on, results_declared, " +
          "exam_dates(id, exam_date), " +
          "exam_classes(class_id, classes(id, name, section)), " +
          "exam_papers(id, class_id, subject_id, paper_date, start_time, end_time, room, max_marks, pass_marks, classes(id, name, section), subjects(name, code))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    let list = (rows ?? []).map((ex: any) => {
      const dates = sortDates((ex.exam_dates ?? []).map((d: any) => d.exam_date));
      return {
        ...ex,
        dates,
        starts_on: dates[0] ?? ex.starts_on ?? null,
        ends_on: dates[dates.length - 1] ?? ex.ends_on ?? null,
        classes_list: (ex.exam_classes ?? [])
          .map((c: any) => c.classes)
          .filter(Boolean)
          .sort((a: any, b: any) =>
            (Number(a.name) || 0) - (Number(b.name) || 0) ||
            String(a.name).localeCompare(String(b.name)) ||
            String(a.section).localeCompare(String(b.section)),
          ),
      };
    });

    if (data.class_id) {
      list = list.filter((ex: any) =>
        (ex.exam_classes ?? []).some((c: any) => c.class_id === data.class_id),
      );
    }
    return list;
  });

export const createExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; dates: string[]; class_ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const dates = sortDates(data.dates ?? []);
    if (!dates.length) throw new Error("Pick at least one date");
    if (!data.class_ids?.length) throw new Error("Pick at least one class");

    const { data: s } = await (context.supabase as any)
      .from("school_settings")
      .select("academic_year")
      .limit(1)
      .maybeSingle();

    const { data: row, error } = await (context.supabase as any)
      .from("exams")
      .insert({
        name: data.name.trim(),
        starts_on: dates[0],
        ends_on: dates[dates.length - 1],
        academic_year: s?.academic_year ?? "2025-26",
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: dErr } = await (context.supabase as any)
      .from("exam_dates")
      .insert(dates.map((d) => ({ exam_id: row.id, exam_date: d })));
    if (dErr) throw new Error(dErr.message);

    const { error: cErr } = await (context.supabase as any)
      .from("exam_classes")
      .insert(data.class_ids.map((c) => ({ exam_id: row.id, class_id: c })));
    if (cErr) throw new Error(cErr.message);

    return row;
  });

export const updateExamTerm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; name?: string; dates?: string[]; class_ids?: string[] }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const sb = context.supabase as any;

    if (data.dates?.length) {
      const dates = sortDates(data.dates);
      // Papers on dropped dates must go first (the date-validation trigger).
      await sb.from("exam_papers").delete().eq("exam_id", data.id).not("paper_date", "in", `(${dates.join(",")})`);
      await sb.from("exam_dates").delete().eq("exam_id", data.id).not("exam_date", "in", `(${dates.join(",")})`);
      const { data: existing } = await sb.from("exam_dates").select("exam_date").eq("exam_id", data.id);
      const have = new Set((existing ?? []).map((d: any) => d.exam_date));
      const toAdd = dates.filter((d) => !have.has(d));
      if (toAdd.length)
        await sb.from("exam_dates").insert(toAdd.map((d) => ({ exam_id: data.id, exam_date: d })));
    }

    if (data.class_ids?.length) {
      const ids = Array.from(new Set(data.class_ids));
      await sb.from("exam_papers").delete().eq("exam_id", data.id).not("class_id", "in", `(${ids.join(",")})`);
      await sb.from("exam_classes").delete().eq("exam_id", data.id).not("class_id", "in", `(${ids.join(",")})`);
      const { data: existing } = await sb.from("exam_classes").select("class_id").eq("exam_id", data.id);
      const have = new Set((existing ?? []).map((c: any) => c.class_id));
      const toAdd = ids.filter((c) => !have.has(c));
      if (toAdd.length)
        await sb.from("exam_classes").insert(toAdd.map((c) => ({ exam_id: data.id, class_id: c })));
    }

    const patch: any = {};
    if (data.name) patch.name = data.name.trim();
    if (data.dates?.length) {
      const dates = sortDates(data.dates);
      patch.starts_on = dates[0];
      patch.ends_on = dates[dates.length - 1];
    }
    if (Object.keys(patch).length) {
      const { error } = await sb.from("exams").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("exams").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const declareResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string; declared: boolean }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await (context.supabase as any)
      .from("exams")
      .update({ results_declared: data.declared })
      .eq("id", data.exam_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- EXAM PAPERS ---------------- */

export const upsertExamPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      exam_id: string;
      class_id: string;
      subject_id: string;
      paper_date: string;
      start_time?: string | null;
      end_time?: string | null;
      room?: string | null;
      max_marks: number;
      pass_marks?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const payload: any = {
      exam_id: data.exam_id,
      class_id: data.class_id,
      subject_id: data.subject_id,
      paper_date: data.paper_date,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      room: data.room || null,
      max_marks: data.max_marks,
      pass_marks: data.pass_marks ?? null,
    };
    if (data.id) {
      const { error } = await (context.supabase as any)
        .from("exam_papers")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any).from("exam_papers").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const saveSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      exam_id: string;
      cells: { class_id: string; paper_date: string; subject_id: string | null }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const sb = context.supabase as any;

    const { data: existing, error: exErr } = await sb
      .from("exam_papers")
      .select("id, class_id, paper_date, subject_id")
      .eq("exam_id", data.exam_id);
    if (exErr) throw new Error(exErr.message);

    const key = (c: string, d: string) => `${c}|${d}`;
    const have = new Map<string, any>();
    (existing ?? []).forEach((p: any) => have.set(key(p.class_id, p.paper_date), p));

    const toInsert: any[] = [];
    const toDelete: string[] = [];

    for (const cell of data.cells) {
      const cur = have.get(key(cell.class_id, cell.paper_date));
      if (!cell.subject_id) {
        if (cur) toDelete.push(cur.id);
        continue;
      }
      if (!cur) {
        toInsert.push({
          exam_id: data.exam_id,
          class_id: cell.class_id,
          paper_date: cell.paper_date,
          subject_id: cell.subject_id,
          max_marks: 100,
        });
      } else if (cur.subject_id !== cell.subject_id) {
        const { error } = await sb
          .from("exam_papers")
          .update({ subject_id: cell.subject_id })
          .eq("id", cur.id);
        if (error) throw new Error(error.message);
      }
    }

    if (toDelete.length) {
      const { error } = await sb.from("exam_papers").delete().in("id", toDelete);
      if (error) throw new Error(error.message);
    }
    if (toInsert.length) {
      const { error } = await sb.from("exam_papers").insert(toInsert);
      if (error) throw new Error(error.message);
    }
    return { ok: true, created: toInsert.length, removed: toDelete.length };
  });

export const deleteExamPaper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("exam_papers")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUpcomingExams = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id?: string; days?: number }) => input)
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const later = new Date();
    later.setDate(later.getDate() + (data.days ?? 30));
    const laterISO = later.toISOString().slice(0, 10);
    let q = (context.supabase as any)
      .from("exam_papers")
      .select(
        "id, class_id, paper_date, start_time, end_time, room, max_marks, " +
          "subjects(name), classes(name, section), exams(id, name)",
      )
      .gte("paper_date", today)
      .lte("paper_date", laterISO)
      .order("paper_date", { ascending: true })
      .limit(20);
    if (data.class_id) q = q.eq("class_id", data.class_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/* ---------------- PENDING RESULTS ---------------- */

export const listPendingResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const today = new Date().toISOString().slice(0, 10);

    const priv = await hasAnyRole(sb, context.userId, ["admin", "coordinator"]);

    let allowed: Set<string> | null = null;
    if (!priv) {
      const { data: teacher } = await sb
        .from("teachers")
        .select("id")
        .eq("profile_id", context.userId)
        .maybeSingle();
      if (!teacher) return [];
      const { data: tc } = await sb
        .from("teacher_classes")
        .select("class_id")
        .eq("teacher_id", teacher.id)
        .eq("is_class_teacher", true);
      allowed = new Set((tc ?? []).map((r: any) => r.class_id));
      if (!allowed.size) return [];
    }

    const { data: rows, error } = await sb
      .from("exams")
      .select(
        "id, name, results_declared, exam_dates(exam_date), " +
          "exam_papers(id, class_id, classes(id, name, section))",
      )
      .eq("results_declared", false);
    if (error) throw new Error(error.message);

    const pending = (rows ?? [])
      .map((ex: any) => {
        const dates = sortDates((ex.exam_dates ?? []).map((d: any) => d.exam_date));
        return { ...ex, last_date: dates[dates.length - 1] ?? null };
      })
      .filter((ex: any) => ex.last_date && ex.last_date < today);
    if (!pending.length) return [];

    const paperIds = pending.flatMap((ex: any) =>
      (ex.exam_papers ?? [])
        .filter((p: any) => !allowed || allowed.has(p.class_id))
        .map((p: any) => p.id),
    );
    const entered = new Set<string>();
    if (paperIds.length) {
      const { data: marks } = await sb
        .from("marks")
        .select("exam_paper_id")
        .in("exam_paper_id", paperIds)
        .not("marks_obtained", "is", null);
      (marks ?? []).forEach((m: any) => entered.add(m.exam_paper_id));
    }

    const result = pending
      .map((ex: any) => {
        const byClass = new Map<string, any>();
        for (const p of ex.exam_papers ?? []) {
          if (allowed && !allowed.has(p.class_id)) continue;
          if (!byClass.has(p.class_id))
            byClass.set(p.class_id, {
              class_id: p.class_id,
              label: p.classes ? `${p.classes.name} ${p.classes.section}` : "—",
              total: 0,
              entered: 0,
            });
          const row = byClass.get(p.class_id);
          row.total += 1;
          if (entered.has(p.id)) row.entered += 1;
        }
        return {
          exam_id: ex.id,
          exam_name: ex.name,
          last_date: ex.last_date,
          classes: Array.from(byClass.values()).sort((a, b) =>
            (Number(a.label.split(" ")[0]) || 0) - (Number(b.label.split(" ")[0]) || 0) ||
            a.label.localeCompare(b.label),
          ),
        };
      })
      .filter((ex: any) => ex.classes.length);

    return result.sort((a: any, b: any) => b.last_date.localeCompare(a.last_date));
  });

/* ---------------- STUDENT-BY-STUDENT RESULTS ENTRY ---------------- */

async function allowedClassIds(sb: any, userId: string): Promise<Set<string> | null> {
  if (await hasAnyRole(sb, userId, ["admin", "coordinator"])) return null; // null = all
  const { data: teacher } = await sb
    .from("teachers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (!teacher) return new Set<string>();
  const { data: tc } = await sb
    .from("teacher_classes")
    .select("class_id")
    .eq("teacher_id", teacher.id)
    .eq("is_class_teacher", true);
  return new Set((tc ?? []).map((r: any) => r.class_id));
}

export const listExamClassesForEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const allowed = await allowedClassIds(sb, context.userId);
    const { data: rows, error } = await sb
      .from("exam_classes")
      .select("class_id, classes(id, name, section)")
      .eq("exam_id", data.exam_id);
    if (error) throw new Error(error.message);
    return (rows ?? [])
      .filter((r: any) => r.classes && (!allowed || allowed.has(r.class_id)))
      .map((r: any) => ({
        id: r.class_id,
        label: `${r.classes.name} ${r.classes.section}`,
        name: r.classes.name,
        section: r.classes.section,
      }))
      .sort(
        (a: any, b: any) =>
          (Number(a.name) || 0) - (Number(b.name) || 0) ||
          String(a.name).localeCompare(String(b.name)) ||
          String(a.section).localeCompare(String(b.section)),
      );
  });

export const listStudentResultSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string; class_id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const allowed = await allowedClassIds(sb, context.userId);
    if (allowed && !allowed.has(data.class_id)) throw new Error("Forbidden");

    const { data: students, error: sErr } = await sb
      .from("students")
      .select("id, roll_number, profile:profiles!students_profile_id_fkey(full_name)")
      .eq("class_id", data.class_id)
      .order("roll_number", { ascending: true, nullsFirst: false });
    if (sErr) throw new Error(sErr.message);

    const { data: papers, error: pErr } = await sb
      .from("exam_papers")
      .select("id, max_marks, paper_date, subjects(name)")
      .eq("exam_id", data.exam_id)
      .eq("class_id", data.class_id)
      .order("paper_date", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    return {
      students: (students ?? []).map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        full_name: s.profile?.full_name ?? "—",
      })),
      papers: (papers ?? []).map((p: any) => ({
        paper_id: p.id,
        subject: p.subjects?.name ?? "—",
        max_marks: p.max_marks,
        paper_date: p.paper_date,
      })),
    };
  });

export const listStudentMarks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string; class_id: string; student_id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const allowed = await allowedClassIds(sb, context.userId);
    if (allowed && !allowed.has(data.class_id)) throw new Error("Forbidden");

    const { data: papers } = await sb
      .from("exam_papers")
      .select("id")
      .eq("exam_id", data.exam_id)
      .eq("class_id", data.class_id);
    const ids = (papers ?? []).map((p: any) => p.id);
    if (!ids.length) return [];

    const { data: marks, error } = await sb
      .from("marks")
      .select(
        "exam_paper_id, marks_obtained, grade, remarks, updated_at, entered_by, " +
          "editor:profiles!marks_entered_by_fkey(full_name)",
      )
      .eq("student_id", data.student_id)
      .in("exam_paper_id", ids);
    if (error) throw new Error(error.message);

    return (marks ?? []).map((m: any) => ({
      exam_paper_id: m.exam_paper_id,
      marks_obtained: m.marks_obtained,
      grade: m.grade,
      remarks: m.remarks,
      updated_at: m.updated_at,
      edited_by: m.editor?.full_name ?? null,
    }));
  });

export const saveStudentMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entries: {
        exam_paper_id: string;
        student_id: string;
        marks_obtained: number | null;
        grade?: string | null;
        remarks?: string | null;
      }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!data.entries?.length) return { ok: true };
    await assertNotLocked(
      context.supabase as any,
      context.userId,
      Array.from(new Set(data.entries.map((e) => e.exam_paper_id))),
    );

    const rows = data.entries.map((e) => ({
      exam_paper_id: e.exam_paper_id,
      student_id: e.student_id,
      marks_obtained: e.marks_obtained,
      grade: e.grade ?? null,
      remarks: e.remarks ?? null,
      entered_by: context.userId,
    }));
    const { error } = await (context.supabase as any)
      .from("marks")
      .upsert(rows, { onConflict: "exam_paper_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- BULK MARKS IMPORT ---------------- */

export const getMarksSheetForClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_id: string; class_id: string }) => input)
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const allowed = await allowedClassIds(sb, context.userId);
    if (allowed && !allowed.has(data.class_id)) throw new Error("Forbidden");

    const { data: students, error: sErr } = await sb
      .from("students")
      .select("id, roll_number, profile:profiles!students_profile_id_fkey(full_name)")
      .eq("class_id", data.class_id)
      .order("roll_number", { ascending: true, nullsFirst: false });
    if (sErr) throw new Error(sErr.message);

    const { data: papers, error: pErr } = await sb
      .from("exam_papers")
      .select("id, max_marks, paper_date, subjects(name)")
      .eq("exam_id", data.exam_id)
      .eq("class_id", data.class_id)
      .order("paper_date", { ascending: true });
    if (pErr) throw new Error(pErr.message);

    const paperIds = (papers ?? []).map((p: any) => p.id);
    let marks: any[] = [];
    if (paperIds.length) {
      const { data: m, error: mErr } = await sb
        .from("marks")
        .select("exam_paper_id, student_id, marks_obtained")
        .in("exam_paper_id", paperIds);
      if (mErr) throw new Error(mErr.message);
      marks = m ?? [];
    }

    return {
      students: (students ?? []).map((s: any) => ({
        id: s.id,
        roll_number: s.roll_number,
        full_name: s.profile?.full_name ?? "—",
      })),
      papers: (papers ?? []).map((p: any) => ({
        paper_id: p.id,
        subject: p.subjects?.name ?? "—",
        max_marks: Number(p.max_marks),
      })),
      marks: marks.map((m) => ({
        exam_paper_id: m.exam_paper_id,
        student_id: m.student_id,
        marks_obtained: m.marks_obtained === null ? null : Number(m.marks_obtained),
      })),
    };
  });

export const importMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      exam_id: string;
      class_id: string;
      entries: {
        exam_paper_id: string;
        student_id: string;
        marks_obtained: number;
        roll?: string;
        subject?: string;
      }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const allowed = await allowedClassIds(sb, context.userId);
    if (allowed && !allowed.has(data.class_id)) throw new Error("Forbidden");

    const priv = await hasAnyRole(sb, context.userId, ["admin", "coordinator"]);
    const { data: exam } = await sb
      .from("exams")
      .select("results_declared")
      .eq("id", data.exam_id)
      .maybeSingle();
    if (exam?.results_declared && !priv) throw new Error(RESULTS_LOCKED_MESSAGE);

    const { data: papers, error: pErr } = await sb
      .from("exam_papers")
      .select("id, max_marks, subjects(name)")
      .eq("exam_id", data.exam_id)
      .eq("class_id", data.class_id);
    if (pErr) throw new Error(pErr.message);
    const paperById = new Map<string, any>((papers ?? []).map((p: any) => [p.id, p]));

    const { data: studs } = await sb.from("students").select("id").eq("class_id", data.class_id);
    const studentIds = new Set<string>((studs ?? []).map((s: any) => s.id));

    const skipped: { roll: string; subject: string; reason: string }[] = [];
    const valid: typeof data.entries = [];
    for (const e of data.entries ?? []) {
      const label = { roll: e.roll ?? "—", subject: e.subject ?? "—" };
      const paper = paperById.get(e.exam_paper_id);
      if (!paper) {
        skipped.push({ ...label, reason: "Subject is not scheduled for this class in this term" });
        continue;
      }
      if (!studentIds.has(e.student_id)) {
        skipped.push({ ...label, reason: "Student is not in this class" });
        continue;
      }
      const v = Number(e.marks_obtained);
      if (!Number.isFinite(v)) {
        skipped.push({ ...label, reason: "Marks value is not a number" });
        continue;
      }
      if (v < 0) {
        skipped.push({ ...label, reason: "Marks cannot be negative" });
        continue;
      }
      if (v > Number(paper.max_marks)) {
        skipped.push({ ...label, reason: `Marks exceed max (${paper.max_marks})` });
        continue;
      }
      valid.push({ ...e, marks_obtained: v });
    }

    if (!valid.length) return { created: 0, updated: 0, skipped };

    const paperIds = Array.from(new Set(valid.map((e) => e.exam_paper_id)));
    const { data: existing } = await sb
      .from("marks")
      .select("exam_paper_id, student_id")
      .in("exam_paper_id", paperIds);
    const existingKeys = new Set(
      (existing ?? []).map((m: any) => `${m.exam_paper_id}|${m.student_id}`),
    );

    let created = 0;
    let updated = 0;
    for (const e of valid) {
      if (existingKeys.has(`${e.exam_paper_id}|${e.student_id}`)) updated++;
      else created++;
    }

    const { error } = await sb.from("marks").upsert(
      valid.map((e) => ({
        exam_paper_id: e.exam_paper_id,
        student_id: e.student_id,
        marks_obtained: e.marks_obtained,
        entered_by: context.userId,
      })),
      { onConflict: "exam_paper_id,student_id" },
    );
    if (error) throw new Error(error.message);

    return { created, updated, skipped };
  });

/* ---------------- MARKS ---------------- */


export const listMarksForEntry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { exam_paper_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: paper } = await (context.supabase as any)
      .from("exam_papers")
      .select("id, max_marks, exam_id, class_id")
      .eq("id", data.exam_paper_id)
      .maybeSingle();
    if (!paper) throw new Error("Paper not found");
    const { data: students, error } = await (context.supabase as any)
      .from("students")
      .select("id, roll_number, profile:profiles!students_profile_id_fkey(full_name)")
      .eq("class_id", paper.class_id)
      .order("roll_number", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const { data: marks } = await (context.supabase as any)
      .from("marks")
      .select(
        "student_id, marks_obtained, grade, remarks, updated_at, entered_by, " +
          "editor:profiles!marks_entered_by_fkey(full_name)",
      )
      .eq("exam_paper_id", data.exam_paper_id);
    const map = new Map<string, any>();
    (marks ?? []).forEach((m: any) => map.set(m.student_id, m));
    return (students ?? []).map((s: any) => ({
      id: s.id,
      roll_number: s.roll_number,
      full_name: s.profile?.full_name ?? "—",
      marks_obtained: map.get(s.id)?.marks_obtained ?? null,
      grade: map.get(s.id)?.grade ?? null,
      remarks: map.get(s.id)?.remarks ?? null,
      updated_at: map.get(s.id)?.updated_at ?? null,
      edited_by: map.get(s.id)?.editor?.full_name ?? null,
      max_marks: paper.max_marks,
    }));
  });

export const saveMarks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      exam_paper_id: string;
      entries: {
        student_id: string;
        marks_obtained: number | null;
        grade?: string | null;
        remarks?: string | null;
      }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertNotLocked(context.supabase as any, context.userId, [data.exam_paper_id]);
    const rows = data.entries.map((e) => ({
      exam_paper_id: data.exam_paper_id,
      student_id: e.student_id,
      marks_obtained: e.marks_obtained,
      grade: e.grade ?? null,
      remarks: e.remarks ?? null,
      entered_by: context.userId,
    }));
    if (!rows.length) return { ok: true };

    const { error } = await (context.supabase as any)
      .from("marks")
      .upsert(rows, { onConflict: "exam_paper_id,student_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- STUDENT / PARENT RESULT VIEW ---------------- */

export const myResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { student_profile_id?: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = data.student_profile_id ?? context.userId;
    const sb = context.supabase as any;
    const { data: student } = await sb
      .from("students")
      .select("id, class_id")
      .eq("profile_id", pid)
      .maybeSingle();
    if (!student?.class_id) return [];

    // Papers for this student's class, grouped by their exam term.
    const { data: papers } = await sb
      .from("exam_papers")
      .select(
        "id, max_marks, paper_date, subjects(name), " +
          "exams(id, name, starts_on, ends_on, results_declared)",
      )
      .eq("class_id", student.class_id)
      .order("paper_date", { ascending: true });

    const declared = (papers ?? []).filter((p: any) => p.exams?.results_declared);
    if (!declared.length) return [];

    const { data: marks } = await sb
      .from("marks")
      .select("exam_paper_id, marks_obtained, grade")
      .in("exam_paper_id", declared.map((p: any) => p.id))
      .eq("student_id", student.id);
    const marksByPaper = new Map<string, any>();
    (marks ?? []).forEach((m: any) => marksByPaper.set(m.exam_paper_id, m));

    const byExam = new Map<string, any>();
    for (const p of declared) {
      const ex = p.exams;
      if (!byExam.has(ex.id)) {
        byExam.set(ex.id, {
          id: ex.id,
          name: ex.name,
          starts_on: p.paper_date,
          ends_on: p.paper_date,
          results_declared: true,
          marks: [] as any[],
        });
      }
      const entry = byExam.get(ex.id);
      if (p.paper_date < entry.starts_on) entry.starts_on = p.paper_date;
      if (p.paper_date > entry.ends_on) entry.ends_on = p.paper_date;
      const m = marksByPaper.get(p.id);
      entry.marks.push({
        subject: p.subjects?.name ?? "—",
        obtained: m?.marks_obtained ?? null,
        max: p.max_marks,
        grade: m?.grade ?? null,
      });
    }
    return Array.from(byExam.values()).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  });

/* ---------------- EXAM TIMETABLE for a class ---------------- */

export const listExamSchedule = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id: string }) => input)
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data: papers, error } = await (context.supabase as any)
      .from("exam_papers")
      .select(
        "id, paper_date, start_time, end_time, room, max_marks, subjects(name), " +
          "exams(id, name)",
      )
      .eq("class_id", data.class_id)
      .gte("paper_date", today)
      .order("paper_date", { ascending: true });
    if (error) throw new Error(error.message);

    const byExam = new Map<string, any>();
    for (const p of papers ?? []) {
      const ex = p.exams;
      if (!ex) continue;
      if (!byExam.has(ex.id))
        byExam.set(ex.id, {
          id: ex.id,
          name: ex.name,
          starts_on: p.paper_date,
          ends_on: p.paper_date,
          exam_papers: [] as any[],
        });
      const entry = byExam.get(ex.id);
      if (p.paper_date < entry.starts_on) entry.starts_on = p.paper_date;
      if (p.paper_date > entry.ends_on) entry.ends_on = p.paper_date;
      entry.exam_papers.push(p);
    }
    return Array.from(byExam.values()).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
  });
