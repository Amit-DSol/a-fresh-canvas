import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const myStudentInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: student } = await (context.supabase as any)
      .from("students")
      .select(
        "id, roll_number, admission_number, class_id, " +
          "profile:profiles!students_profile_id_fkey(full_name, email), " +
          "classes(id, name, section)",
      )
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!student) return null;

    let classTeacher: { profile_id: string; full_name: string } | null = null;
    if (student.class_id) {
      const { data: tc } = await (context.supabase as any)
        .from("teacher_classes")
        .select("teachers(profile_id, profile:profiles!teachers_profile_id_fkey(full_name))")
        .eq("class_id", student.class_id)
        .eq("is_class_teacher", true)
        .limit(1)
        .maybeSingle();
      const t = tc?.teachers;
      if (t?.profile_id) {
        classTeacher = { profile_id: t.profile_id, full_name: t.profile?.full_name ?? "Class Teacher" };
      }
    }

    return {
      id: student.id,
      roll_number: student.roll_number,
      admission_number: student.admission_number,
      full_name: student.profile?.full_name ?? "—",
      class_name: student.classes?.name ?? null,
      class_section: student.classes?.section ?? null,
      class_teacher: classTeacher,
    };
  });
