import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ClassRow = { id: string; name: string; section: string };

/** Classes the caller may see analytics for, plus whether they are privileged. */
async function scopedClasses(
  supabase: any,
  userId: string,
): Promise<{ classes: ClassRow[]; privileged: boolean }> {
  let privileged = false;
  for (const r of ["admin", "coordinator"]) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) { privileged = true; break; }
  }
  if (privileged) {
    const { data, error } = await supabase.from("classes").select("id, name, section").order("name");
    if (error) throw new Error(error.message);
    return { classes: (data ?? []) as ClassRow[], privileged: true };
  }
  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (!teacher) return { classes: [], privileged: false };
  // Only class teachers get attendance analytics for their class.
  const { data, error } = await supabase
    .from("teacher_classes")
    .select("is_class_teacher, classes(id, name, section)")
    .eq("teacher_id", teacher.id)
    .eq("is_class_teacher", true);
  if (error) throw new Error(error.message);
  const classes = (data ?? []).map((r: any) => r.classes).filter(Boolean) as ClassRow[];
  return { classes, privileged: false };
}

export const analyticsScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { classes, privileged } = await scopedClasses(context.supabase, context.userId);
    return { classes, privileged };
  });

type AttRow = { class_id: string; student_id: string; status: string };

async function fetchAttendance(
  supabase: any,
  classIds: string[],
  from: string,
  to: string,
): Promise<AttRow[]> {
  if (!classIds.length) return [];
  const out: AttRow[] = [];
  const page = 1000;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await supabase
      .from("attendance")
      .select("class_id, student_id, status")
      .in("class_id", classIds)
      .gte("date", from)
      .lte("date", to)
      .range(offset, offset + page - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as AttRow[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

/** present + late count as attended; holiday is excluded from the denominator. */
function tally(rows: AttRow[], key: (r: AttRow) => string) {
  const m = new Map<string, { present: number; marked: number }>();
  for (const r of rows) {
    if (r.status === "holiday") continue;
    const k = key(r);
    const cur = m.get(k) ?? { present: 0, marked: 0 };
    cur.marked += 1;
    if (r.status === "present" || r.status === "late") cur.present += 1;
    m.set(k, cur);
  }
  return m;
}

export const attendanceByClass = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string }) => input)
  .handler(async ({ data, context }) => {
    const { classes } = await scopedClasses(context.supabase, context.userId);
    const rows = await fetchAttendance(
      context.supabase,
      classes.map((c) => c.id),
      data.from,
      data.to,
    );
    const t = tally(rows, (r) => r.class_id);
    return classes
      .map((c) => {
        const s = t.get(c.id) ?? { present: 0, marked: 0 };
        return {
          class_id: c.id,
          class_label: `${c.name} ${c.section}`.trim(),
          present: s.present,
          marked: s.marked,
          percent: s.marked ? Math.round((s.present / s.marked) * 1000) / 10 : null,
        };
      })
      .sort((a, b) => (b.percent ?? -1) - (a.percent ?? -1));
  });

export const chronicAbsentees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { from: string; to: string; threshold?: number }) => input)
  .handler(async ({ data, context }) => {
    const threshold = data.threshold ?? 75;
    const { classes } = await scopedClasses(context.supabase, context.userId);
    const classIds = classes.map((c) => c.id);
    if (!classIds.length) return [];
    const rows = await fetchAttendance(context.supabase, classIds, data.from, data.to);
    const t = tally(rows, (r) => r.student_id);
    const flagged = [...t.entries()].filter(
      ([, s]) => s.marked > 0 && (s.present / s.marked) * 100 < threshold,
    );
    if (!flagged.length) return [];
    const ids = flagged.map(([id]) => id);
    const students: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data: chunk, error } = await context.supabase
        .from("students")
        .select(
          "id, roll_number, class_id, classes(name, section), profile:profiles!students_profile_id_fkey(full_name)",
        )
        .in("id", ids.slice(i, i + 200));
      if (error) throw new Error(error.message);
      students.push(...(chunk ?? []));
    }
    const byId = new Map(students.map((s) => [s.id, s]));
    return flagged
      .map(([id, s]) => {
        const st = byId.get(id);
        return {
          student_id: id,
          full_name: st?.profile?.full_name ?? "—",
          roll_number: st?.roll_number ?? null,
          class_label: st?.classes ? `${st.classes.name} ${st.classes.section}`.trim() : "—",
          present: s.present,
          marked: s.marked,
          percent: Math.round((s.present / s.marked) * 1000) / 10,
        };
      })
      .sort((a, b) => a.percent - b.percent);
  });
