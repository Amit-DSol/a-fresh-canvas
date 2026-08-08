import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureSignedInUserBootstrap } from "@/lib/auth-bootstrap.server";

export const bootstrapMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSignedInUserBootstrap(context.userId, context.claims as Record<string, unknown>);
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureSignedInUserBootstrap(context.userId, context.claims as Record<string, unknown>);
    const { supabase, userId } = context;
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const roles = (rolesRes.data ?? []).map((r) => r.role as string);
    const priority = ["admin", "coordinator", "teacher", "parent", "student"];
    const primary = priority.find((p) => roles.includes(p)) ?? null;
    return {
      userId,
      profile: profileRes.data,
      roles,
      role: primary as
        | "admin"
        | "coordinator"
        | "teacher"
        | "parent"
        | "student"
        | null,
    };
  });

export const getSchoolSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    // School branding (name, logo, colors) is shown on the public auth page,
    // so read via the admin client and return only non-sensitive fields.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("school_settings")
      .select("id, name, logo_url, primary_color, academic_year, board, onboarding_complete")
      .limit(1)
      .maybeSingle();
    return data;
  },
);

export const getSchoolSettingsFull = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("school_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    return data;
  });

export const isSetupNeeded = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id", { count: "exact", head: true })
    .eq("role", "admin");
  if (error) return { setupNeeded: false };
  return { setupNeeded: (count ?? 0) === 0 };
});

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    const [studentsRes, teachersRes, attRes, examsRes] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("teachers").select("id", { count: "exact", head: true }),
      supabase
        .from("attendance")
        .select("id", { count: "exact", head: true })
        .eq("date", today)
        .eq("status", "present"),
      supabase
        .from("exams")
        .select("id", { count: "exact", head: true })
        .lte("starts_on", monthEnd)
        .gte("ends_on", monthStart),
    ]);

    return {
      students: studentsRes.count ?? 0,
      teachers: teachersRes.count ?? 0,
      attendanceToday: attRes.count ?? 0,
      examsThisMonth: examsRes.count ?? 0,
    };
  });
/* -------------------- UNIFIED LOGIN -------------------- */

/** Public: does this email have an account, and has a password been set yet? */
export const lookupLogin = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => ({
    email: String(input.email ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    if (!data.email) return { exists: false, passwordSet: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("password_set")
      .eq("email", data.email)
      .maybeSingle();
    if (!profile) return { exists: false, passwordSet: false };
    return { exists: true, passwordSet: !!profile.password_set };
  });

/** Public: first-ever login — set the account password. Only when password_set is false. */
export const setInitialPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => ({
    email: String(input.email ?? "").trim().toLowerCase(),
    password: String(input.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Use at least 8 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, password_set")
      .eq("email", data.email)
      .maybeSingle();
    if (!profile) throw new Error("No account found for this email — contact your school admin");
    if (profile.password_set) throw new Error("A password is already set. Sign in or use Forgot password.");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ password_set: true }).eq("id", profile.id);
    return { ok: true };
  });
