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
  const { data } = await supabase.rpc("is_admin_or_coordinator", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}

async function isClassTeacherOfClass(supabase: any, userId: string, classId: string) {
  const { data } = await supabase.rpc("is_class_teacher_of", {
    _user_id: userId,
    _class_id: classId,
  });
  return !!data;
}

async function assertCanManageClass(supabase: any, userId: string, classId?: string | null) {
  if (await hasAnyRole(supabase, userId, ["admin", "coordinator"])) return;
  if (classId && (await isClassTeacherOfClass(supabase, userId, classId))) return;
  throw new Error("Forbidden");
}

async function assertCanManageStudent(admin: any, supabase: any, userId: string, studentId: string) {
  if (await hasAnyRole(supabase, userId, ["admin", "coordinator"])) return;
  const { data: s } = await admin
    .from("students")
    .select("class_id")
    .eq("id", studentId)
    .maybeSingle();
  if (!s?.class_id) throw new Error("Forbidden");
  if (!(await isClassTeacherOfClass(supabase, userId, s.class_id))) throw new Error("Forbidden");
}

function getOrigin(): string {
  // TanStack request origin; falls back to env for hosted deploys.
  try {
    const { getRequest } = require("@tanstack/react-start/server") as {
      getRequest: () => Request;
    };
    const req = getRequest();
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return process.env.SITE_URL ?? "";
  }
}

/**
 * Create or find a profile by email. When newly created, the auth user is
 * created directly with no password and no email — the person sets their own
 * password on their first sign-in at /auth (password_set = false).
 */
async function findOrCreateUser(
  admin: any,
  email: string,
  full_name: string,
  role: "student" | "parent" | "teacher" | "coordinator",
) {
  const normalized = email.trim().toLowerCase();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (existing) return { id: existing.id as string, created: false };

  const { data: created, error } = await admin.auth.admin.createUser({
    email: normalized,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) throw new Error(error.message);

  const newId = created.user!.id as string;

  // Do NOT rely on the handle_new_user trigger — it is not guaranteed to exist
  // (remixed projects don't carry auth-schema triggers). Seed the profile row
  // explicitly before anything else references this id via FK.
  const { error: pErr } = await admin
    .from("profiles")
    .upsert(
      { id: newId, full_name, email: normalized, password_set: false },
      { onConflict: "id" },
    );
  if (pErr) throw new Error(pErr.message);

  // Same for the role row: replace whatever exists with the intended role.
  await admin.from("user_roles").delete().eq("user_id", newId);
  const { error: rErr } = await admin
    .from("user_roles")
    .upsert({ user_id: newId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
  if (rErr) throw new Error(rErr.message);

  return { id: newId, created: true };

}

/** Lets the person choose a fresh password at their next sign-in. No email sent. */
async function resetFirstLoginFor(admin: any, userId: string) {
  const { error } = await admin
    .from("profiles")
    .update({ password_set: false })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/* -------------------- SHARED -------------------- */

export const listClassesForStudentManagement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"])) {
      const { data, error } = await context.supabase
        .from("classes")
        .select("id, name, section")
        .order("name");
      if (error) throw new Error(error.message);
      return { canManageAll: true, classes: data ?? [] };
    }
    // Class teacher: only classes where is_class_teacher = true
    const { data: teacher } = await context.supabase
      .from("teachers")
      .select("id")
      .eq("profile_id", context.userId)
      .maybeSingle();
    if (!teacher) return { canManageAll: false, classes: [] };
    const { data, error } = await context.supabase
      .from("teacher_classes")
      .select("is_class_teacher, classes(id, name, section)")
      .eq("teacher_id", teacher.id)
      .eq("is_class_teacher", true);
    if (error) throw new Error(error.message);
    return {
      canManageAll: false,
      classes: (data ?? []).map((r: any) => r.classes).filter(Boolean),
    };
  });

export const resetFirstLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string }) => input)
  .handler(async ({ data, context }) => {
    // admin/coordinator can reset for anyone. Class teachers can reset for
    // students/guardians in their class.
    const priv = await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!priv) {
      // Check if this user is a student in a class the caller teaches,
      // or a guardian of such a student.
      const { data: stud } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("profile_id", data.user_id)
        .maybeSingle();
      let classId: string | null = stud?.class_id ?? null;
      if (!classId) {
        const { data: g } = await supabaseAdmin
          .from("student_guardians")
          .select("students(class_id)")
          .eq("parent_profile_id", data.user_id);
        classId = (g?.[0] as any)?.students?.class_id ?? null;
      }
      if (!classId || !(await isClassTeacherOfClass(context.supabase, context.userId, classId))) {
        throw new Error("Forbidden");
      }
    }
    await resetFirstLoginFor(supabaseAdmin, data.user_id);
    return { ok: true };
  });

/* -------------------- STUDENTS -------------------- */

export const listStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // RLS restricts what a class teacher sees.
    const { data, error } = await context.supabase
      .from("students")
      .select(
        "id, admission_number, roll_number, date_of_birth, gender, class_id, parent_profile_id, " +
          "profile:profiles!students_profile_id_fkey(id, full_name, email, phone), " +
          "parent:profiles!students_parent_profile_id_fkey(id, full_name, email, phone), " +
          "classes(id, name, section), " +
          "guardians:student_guardians(id, relation, is_primary, phone, parent:profiles!student_guardians_parent_profile_id_fkey(id, full_name, email, phone))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name: string;
      email: string;
      admission_number?: string;
      roll_number?: string;
      class_id?: string;
      date_of_birth?: string;
      gender?: string;
      mother?: { full_name?: string; email?: string; phone?: string };
      father?: { full_name?: string; email?: string; phone?: string };
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertCanManageClass(context.supabase, context.userId, data.class_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const student = await findOrCreateUser(supabaseAdmin, data.email, data.full_name, "student");

    const { data: row, error } = await supabaseAdmin
      .from("students")
      .insert({
        profile_id: student.id,
        class_id: data.class_id || null,
        admission_number: data.admission_number || null,
        roll_number: data.roll_number || null,
        date_of_birth: data.date_of_birth || null,
        gender: data.gender || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    let primaryAssigned = false;
    const parents: {
      relation: "mother" | "father";
      info: { full_name?: string; email?: string; phone?: string };
    }[] = [];
    if (data.mother?.email && data.mother?.full_name)
      parents.push({ relation: "mother", info: data.mother });
    if (data.father?.email && data.father?.full_name)
      parents.push({ relation: "father", info: data.father });
    for (const p of parents) {
      const parent = await findOrCreateUser(
        supabaseAdmin,
        p.info.email!,
        p.info.full_name!,
        "parent",
      );
      if (p.info.phone) {
        await supabaseAdmin.from("profiles").update({ phone: p.info.phone }).eq("id", parent.id);
      }
      await supabaseAdmin.from("student_guardians").insert({
        student_id: row!.id,
        parent_profile_id: parent.id,
        relation: p.relation,
        is_primary: !primaryAssigned,
        phone: p.info.phone || null,
      });
      primaryAssigned = true;
    }

    return row;
  });

export const updateStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      class_id?: string | null;
      admission_number?: string | null;
      roll_number?: string | null;
      date_of_birth?: string | null;
      gender?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageStudent(supabaseAdmin, context.supabase, context.userId, data.id);
    // If class is changing, class teachers must be class teacher of the destination too.
    if (data.class_id !== undefined && data.class_id !== null) {
      const { data: cur } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", data.id)
        .maybeSingle();
      if (cur?.class_id !== data.class_id) {
        await assertCanManageClass(context.supabase, context.userId, data.class_id);
      }
    }
    const { id, ...rest } = data;
    const { error } = await supabaseAdmin.from("students").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageStudent(supabaseAdmin, context.supabase, context.userId, data.id);
    const { error } = await supabaseAdmin.from("students").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- GUARDIANS -------------------- */

export const addGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      student_id: string;
      relation: "mother" | "father" | "guardian";
      full_name: string;
      email: string;
      phone?: string;
      is_primary?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertCanManageStudent(supabaseAdmin, context.supabase, context.userId, data.student_id);
    const parent = await findOrCreateUser(
      supabaseAdmin,
      data.email,
      data.full_name,
      "parent",
    );
    if (data.phone) {
      await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", parent.id);
    }
    // If marking primary, clear other primaries for this student.
    if (data.is_primary) {
      await supabaseAdmin
        .from("student_guardians")
        .update({ is_primary: false })
        .eq("student_id", data.student_id);
    }
    const { data: row, error } = await supabaseAdmin
      .from("student_guardians")
      .insert({
        student_id: data.student_id,
        parent_profile_id: parent.id,
        relation: data.relation,
        is_primary: !!data.is_primary,
        phone: data.phone || null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeGuardian = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: g } = await supabaseAdmin
      .from("student_guardians")
      .select("student_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!g) throw new Error("Not found");
    await assertCanManageStudent(supabaseAdmin, context.supabase, context.userId, g.student_id);
    const { error } = await supabaseAdmin.from("student_guardians").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- TEACHERS -------------------- */

export const listTeachers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("teachers")
      .select(
        "id, employee_id, is_coordinator, profile_id, " +
          "profile:profiles!teachers_profile_id_fkey(id, full_name, email, phone), " +
          "teacher_classes(id, is_class_teacher, classes(id, name, section)), " +
          "teacher_subjects(id, class_id, subject_id, subjects(name), classes(name, section))",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name: string;
      email: string;
      phone?: string;
      employee_id?: string;
      is_coordinator?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const teacher = await findOrCreateUser(
      supabaseAdmin,
      data.email,
      data.full_name,
      data.is_coordinator ? "coordinator" : "teacher",
    );
    if (data.phone) {
      await supabaseAdmin.from("profiles").update({ phone: data.phone }).eq("id", teacher.id);
    }
    if (data.is_coordinator) {
      await supabaseAdmin.from("user_roles").delete().eq("user_id", teacher.id);
      await supabaseAdmin.from("user_roles").insert([
        { user_id: teacher.id, role: "teacher" },
        { user_id: teacher.id, role: "coordinator" },
      ]);
    }
    const { data: row, error } = await supabaseAdmin
      .from("teachers")
      .insert({
        profile_id: teacher.id,
        employee_id: data.employee_id || null,
        is_coordinator: !!data.is_coordinator,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteTeacher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("teachers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignTeacherClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { teacher_id: string; class_id: string; is_class_teacher?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_classes").insert({
      teacher_id: data.teacher_id,
      class_id: data.class_id,
      is_class_teacher: !!data.is_class_teacher,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeacherClass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_classes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignTeacherSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { teacher_id: string; class_id: string; subject_id: string }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_subjects").insert({
      teacher_id: data.teacher_id,
      class_id: data.class_id,
      subject_id: data.subject_id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeTeacherSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("teacher_subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------------------- MISC -------------------- */

export const markPasswordSet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("profiles").update({ password_set: true }).eq("id", context.userId);
    return { ok: true };
  });

/* -------------------- BULK STUDENT IMPORT -------------------- */

export type ImportStudentRow = {
  row: number;
  full_name: string;
  email: string;
  class_id: string;
  roll_number?: string;
  admission_number?: string;
  date_of_birth?: string;
  gender?: string;
  father?: { full_name?: string; email?: string; phone?: string };
  mother?: { full_name?: string; email?: string; phone?: string };
};

export const importStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: ImportStudentRow[] }) => input)
  .handler(async ({ data, context }) => {
    const rows = data.rows ?? [];
    const classIds = Array.from(new Set(rows.map((r) => r.class_id).filter(Boolean)));
    for (const cid of classIds) {
      await assertCanManageClass(context.supabase, context.userId, cid);
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const failures: { row: number; student_name: string; reason: string }[] = [];
    let guardiansCreated = 0;
    let guardiansReused = 0;

    // 1. Student auth accounts (sequential — Supabase admin API is one-at-a-time)
    const studentInserts: any[] = [];
    const okRows: ImportStudentRow[] = [];
    for (const r of rows) {
      try {
        const u = await findOrCreateUser(supabaseAdmin, r.email, r.full_name, "student");
        studentInserts.push({
          profile_id: u.id,
          class_id: r.class_id || null,
          admission_number: r.admission_number || null,
          roll_number: r.roll_number || null,
          date_of_birth: r.date_of_birth || null,
          gender: r.gender || null,
        });
        okRows.push(r);
      } catch (e: any) {
        failures.push({ row: r.row, student_name: r.full_name, reason: e?.message ?? "Could not create login" });
      }
    }

    if (studentInserts.length === 0) {
      return { students_created: 0, guardians_created: 0, guardians_reused: 0, failures };
    }

    // 2. One multi-row insert for students
    const { data: created, error: insErr } = await supabaseAdmin
      .from("students")
      .insert(studentInserts)
      .select("id, profile_id");
    if (insErr) throw new Error(insErr.message);

    const studentIdByProfile = new Map<string, string>();
    (created ?? []).forEach((s: any) => studentIdByProfile.set(s.profile_id, s.id));

    // 3. Guardian accounts, de-duplicated by email across the whole file
    const parentCache = new Map<string, string>();
    const guardianInserts: any[] = [];
    for (let i = 0; i < okRows.length; i++) {
      const r = okRows[i];
      const studentId = studentIdByProfile.get(studentInserts[i].profile_id);
      if (!studentId) continue;
      let primaryAssigned = false;
      const parents: { relation: "mother" | "father"; info: any }[] = [];
      if (r.father?.email && r.father?.full_name) parents.push({ relation: "father", info: r.father });
      if (r.mother?.email && r.mother?.full_name) parents.push({ relation: "mother", info: r.mother });
      for (const p of parents) {
        const key = String(p.info.email).trim().toLowerCase();
        try {
          let pid = parentCache.get(key);
          if (pid) {
            guardiansReused++;
          } else {
            const parent = await findOrCreateUser(supabaseAdmin, p.info.email, p.info.full_name, "parent");
            pid = parent.id;
            parentCache.set(key, pid);
            if (parent.created) guardiansCreated++;
            else guardiansReused++;
            if (p.info.phone) {
              await supabaseAdmin.from("profiles").update({ phone: p.info.phone }).eq("id", pid);
            }
          }
          guardianInserts.push({
            student_id: studentId,
            parent_profile_id: pid,
            relation: p.relation,
            is_primary: !primaryAssigned,
            phone: p.info.phone || null,
          });
          primaryAssigned = true;
        } catch (e: any) {
          failures.push({
            row: r.row,
            student_name: r.full_name,
            reason: `Guardian ${p.relation}: ${e?.message ?? "could not be created"}`,
          });
        }
      }
    }

    // 4. One multi-row insert for guardians
    if (guardianInserts.length > 0) {
      const { error: gErr } = await supabaseAdmin.from("student_guardians").insert(guardianInserts);
      if (gErr) {
        failures.push({ row: 0, student_name: "—", reason: `Guardian links failed: ${gErr.message}` });
      }
    }

    return {
      students_created: created?.length ?? 0,
      guardians_created: guardiansCreated,
      guardians_reused: guardiansReused,
      failures,
    };
  });
