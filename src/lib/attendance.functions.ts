import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Status = "present" | "absent" | "late" | "holiday";

async function hasAnyRole(supabase: any, userId: string, roles: string[]) {
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return true;
  }
  return false;
}

export const listTeacherClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Admins/coordinators see all classes; teachers see assigned classes.
    const isPriv = await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"]);
    if (isPriv) {
      const { data, error } = await context.supabase
        .from("classes")
        .select("id, name, section")
        .order("name");
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    const { data: teacher } = await context.supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!teacher) return [];
    const { data, error } = await context.supabase
      .from("teacher_classes")
      .select("classes(id, name, section)")
      .eq("teacher_id", teacher.id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.classes).filter(Boolean);
  });

export const listStudentsForAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id: string; date: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: students, error } = await context.supabase
      .from("students")
      .select("id, roll_number, admission_number, profile:profiles!students_profile_id_fkey(full_name)")
      .eq("class_id", data.class_id)
      .order("roll_number", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    const { data: existing } = await context.supabase
      .from("attendance")
      .select("student_id, status, note")
      .eq("class_id", data.class_id)
      .eq("date", data.date);
    const map = new Map<string, { status: Status; note: string | null }>();
    (existing ?? []).forEach((r: any) => map.set(r.student_id, { status: r.status, note: r.note }));
    return (students ?? []).map((s: any) => ({
      id: s.id,
      roll_number: s.roll_number,
      admission_number: s.admission_number,
      full_name: s.profile?.full_name ?? "—",
      status: map.get(s.id)?.status ?? null,
      note: map.get(s.id)?.note ?? null,
    }));
  });

export const saveAttendance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      class_id: string;
      date: string;
      entries: { student_id: string; status: Status; note?: string | null }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const rows = data.entries.map((e) => ({
      class_id: data.class_id,
      date: data.date,
      student_id: e.student_id,
      status: e.status,
      note: e.note ?? null,
      marked_by: context.userId,
    }));
    if (!rows.length) return { ok: true, count: 0 };
    const { error } = await context.supabase
      .from("attendance")
      .upsert(rows, { onConflict: "student_id,date" });
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

export const attendanceReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id?: string; from: string; to: string }) => input)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("attendance")
      .select(
        "id, date, status, note, class_id, student_id, " +
          "classes(name, section), " +
          "students(roll_number, profile:profiles!students_profile_id_fkey(full_name))",
      )
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false });
    if (data.class_id) q = q.eq("class_id", data.class_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const myAttendance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; student_profile_id?: string }) => input)
  .handler(async ({ data, context }) => {
    // Parent may pass a linked student's profile id; otherwise use current user's student row.
    let studentProfileId = data.student_profile_id ?? context.userId;
    const { data: student } = await context.supabase
      .from("students")
      .select("id, class_id, profile_id")
      .eq("profile_id", studentProfileId)
      .maybeSingle();
    if (!student) return [];
    // RLS on `attendance` and `student_guardians` enforces access rights.
    const { data: rows, error } = await context.supabase
      .from("attendance")
      .select("id, date, status, note")
      .eq("student_id", student.id)
      .gte("date", data.from)
      .lte("date", data.to)
      .order("date", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });