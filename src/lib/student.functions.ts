import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const myStudentInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { student_id?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const select =
      "id, profile_id, roll_number, admission_number, class_id, " +
      "profile:profiles!students_profile_id_fkey(full_name, email), " +
      "classes(id, name, section)";

    let student: any = null;

    if (data.student_id) {
      // Viewing a specific student (parent opening a linked child, or self by id).
      const { data: allowed } = await (context.supabase as any).rpc("is_parent_of_student", {
        _user_id: context.userId,
        _student_id: data.student_id,
      });
      const { data: row } = await (context.supabase as any)
        .from("students")
        .select(select)
        .eq("id", data.student_id)
        .maybeSingle();
      const isSelf = row?.profile_id === context.userId;
      if (!allowed && !isSelf) return { denied: true as const };
      if (!row) return { denied: true as const };
      student = row;
    } else {
      const { data: row } = await (context.supabase as any)
        .from("students")
        .select(select)
        .eq("profile_id", context.userId)
        .maybeSingle();
      student = row;
    }

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
      profile_id: student.profile_id,
      roll_number: student.roll_number,
      admission_number: student.admission_number,
      full_name: student.profile?.full_name ?? "—",
      class_id: student.class_id ?? null,
      class_name: student.classes?.name ?? null,
      class_section: student.classes?.section ?? null,
      class_teacher: classTeacher,
    };
  });
