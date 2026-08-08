import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id?: string; from?: string; to?: string }) => input)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("homework")
      .select(
        "id, class_id, subject_id, teacher_id, description, date, due_date, " +
          "classes(name, section), subjects(name), teachers(profile:profiles!teachers_profile_id_fkey(full_name))",
      )
      .order("date", { ascending: false });
    if (data.class_id) q = q.eq("class_id", data.class_id);
    if (data.from) q = q.gte("date", data.from);
    if (data.to) q = q.lte("date", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const createHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { class_id: string; subject_id?: string | null; description: string; date: string; due_date?: string | null }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { data: teacher } = await context.supabase.from("teachers").select("id").eq("profile_id", context.userId).maybeSingle();
    const { data: row, error } = await context.supabase
      .from("homework")
      .insert({
        class_id: data.class_id,
        subject_id: data.subject_id ?? null,
        description: data.description,
        date: data.date,
        due_date: data.due_date ?? null,
        teacher_id: teacher?.id ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("homework").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const myClassHomework = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { student_profile_id?: string }) => input)
  .handler(async ({ data, context }) => {
    const pid = data.student_profile_id ?? context.userId;
    const { data: student } = await context.supabase
      .from("students")
      .select("class_id")
      .eq("profile_id", pid)
      .maybeSingle();
    if (!student?.class_id) return [];
    // RLS enforces parent access via student_guardians.
    const { data: rows, error } = await context.supabase
      .from("homework")
      .select("id, description, date, due_date, subjects(name)")
      .eq("class_id", student.class_id)
      .order("date", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
