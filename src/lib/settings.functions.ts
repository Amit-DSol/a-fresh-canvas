import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

async function assertAdminOrCoordinator(supabase: any, userId: string) {
  const { data } = await supabase.rpc("is_admin_or_coordinator", { _user_id: userId });
  if (!data) throw new Error("Forbidden");
}


export const updateSchoolSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    name?: string;
    academic_year?: string;
    board?: string | null;
    principal_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    logo_url?: string | null;
    primary_color?: string;
    onboarding_complete?: boolean;
  }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: existing } = await context.supabase
      .from("school_settings")
      .select("id")
      .limit(1)
      .maybeSingle();
    if (!existing) {
      const { data: created, error } = await context.supabase
        .from("school_settings")
        .insert({ name: data.name ?? "My School", ...data })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return created;
    }
    const { data: updated, error } = await context.supabase
      .from("school_settings")
      .update(data)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const listClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("classes")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createClassFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; section: string; academic_year?: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    let ay = data.academic_year;
    if (!ay) {
      const { data: s } = await context.supabase
        .from("school_settings")
        .select("academic_year")
        .limit(1)
        .maybeSingle();
      ay = s?.academic_year ?? "2025-26";
    }
    const { data: row, error } = await context.supabase
      .from("classes")
      .insert({ name: data.name.trim(), section: data.section.trim(), academic_year: ay })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteClassFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("classes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("subjects")
      .select("id, name, code, class_id, classes(name, section)")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createSubjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { class_id: string; name: string; code?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("subjects")
      .insert({ class_id: data.class_id, name: data.name.trim(), code: data.code?.trim() || null })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSubjectFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdminOrCoordinator(context.supabase, context.userId);
    const { error } = await context.supabase.from("subjects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profiles, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const { data: roles } = await context.supabase.from("user_roles").select("user_id, role");
    const byUser = new Map<string, string[]>();
    (roles ?? []).forEach((r: any) => {
      const list = byUser.get(r.user_id) ?? [];
      list.push(r.role);
      byUser.set(r.user_id, list);
    });
    return (profiles ?? []).map((p: any) => ({ ...p, roles: byUser.get(p.id) ?? [] }));
  });

export const updateUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { user_id: string; role: "admin" | "coordinator" | "teacher" | "parent" | "student" }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (error) throw new Error(error.message);
    return { ok: true };
  });