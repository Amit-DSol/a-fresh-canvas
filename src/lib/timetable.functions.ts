import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hasAnyRole(supabase: any, userId: string, roles: string[]) {
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return true;
  }
  return false;
}

export const listTimetable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id?: string; teacher_profile_id?: string }) => input)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("timetable")
      .select(
        "id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, " +
          "classes(name, section), subjects(name), teachers(profile:profiles!teachers_profile_id_fkey(full_name))",
      )
      .order("day_of_week")
      .order("period_number");
    if (data.class_id) q = q.eq("class_id", data.class_id);
    if (data.teacher_profile_id) {
      const { data: t } = await context.supabase.from("teachers").select("id").eq("profile_id", data.teacher_profile_id).maybeSingle();
      if (!t) return [];
      q = q.eq("teacher_id", t.id);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string;
      class_id: string;
      subject_id?: string | null;
      teacher_id?: string | null;
      day_of_week: number;
      period_number: number;
      start_time?: string | null;
      end_time?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!(await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"])))
      throw new Error("Forbidden");
    if (data.id) {
      const { error } = await context.supabase.from("timetable").update(data).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("timetable").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    if (!(await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"])))
      throw new Error("Forbidden");
    const { error } = await context.supabase.from("timetable").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeachersForPicker = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("teachers")
      .select("id, profile:profiles!teachers_profile_id_fkey(full_name)");
    if (error) throw new Error(error.message);
    return (data ?? []).map((t: any) => ({ id: t.id, name: t.profile?.full_name ?? "—" }));
  });
