import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ensures the signed-in auth user has a profile row and a role.
 * - If an imported profile exists with the same email, it is linked to the auth user id.
 * - The very first user to sign in becomes 'admin'; everyone else defaults to 'student'.
 */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;
    const email = (context.claims as { email?: string })?.email ?? "";
    const fullName =
      ((context.claims as { user_metadata?: { full_name?: string } })?.user_metadata
        ?.full_name as string | undefined) ?? (email ? email.split("@")[0]! : "User");

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      await supabaseAdmin
        .from("profiles")
        .insert({ id: userId, full_name: fullName, email });
    }

    if (existingRole?.role) {
      return { role: existingRole.role, fullName: profile?.full_name ?? fullName };
    }

    const { count: adminCount } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");

    const role = (adminCount ?? 0) === 0 ? "admin" : "student";
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });

    if (role === "admin") {
      const { count: settingsCount } = await supabaseAdmin
        .from("school_settings")
        .select("id", { count: "exact", head: true });
      if ((settingsCount ?? 0) === 0) {
        await supabaseAdmin.from("school_settings").insert({ name: "My School" });
      }
    }

    return { role, fullName: profile?.full_name ?? fullName };
  });
