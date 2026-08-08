type BootstrapClaims = Record<string, unknown> | null | undefined;

function claimString(claims: BootstrapClaims, key: string): string | null {
  const value = claims?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function claimMetadataString(claims: BootstrapClaims, key: string): string | null {
  const metadata = claims?.user_metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function nameFromEmail(email: string | null): string {
  if (!email) return "School Admin";
  return email.split("@")[0]?.replace(/[._-]+/g, " ").trim() || "School Admin";
}

export async function ensureSignedInUserBootstrap(userId: string, claims: BootstrapClaims) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const emailFromClaims = claimString(claims, "email");
  const fullNameFromClaims =
    claimMetadataString(claims, "full_name") ??
    claimMetadataString(claims, "name") ??
    claimString(claims, "name");

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  const email = emailFromClaims ?? authUser.user?.email ?? `${userId}@users.local`;
  const userMetadata = authUser.user?.user_metadata as Record<string, unknown> | undefined;
  const metadataName =
    typeof userMetadata?.full_name === "string"
      ? userMetadata.full_name
      : typeof userMetadata?.name === "string"
        ? userMetadata.name
        : null;
  const fullName = fullNameFromClaims ?? metadataName ?? nameFromEmail(email);

  await supabaseAdmin
    .from("profiles")
    .upsert(
      { id: userId, full_name: fullName, email },
      { onConflict: "id", ignoreDuplicates: true },
    );

  const [{ count: adminCount }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const existingRoles = (roles ?? []).map((row) => row.role as string);
  if ((adminCount ?? 0) === 0 && !existingRoles.includes("admin")) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  } else if (existingRoles.length === 0) {
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "student" }, { onConflict: "user_id,role", ignoreDuplicates: true });
  }

  const { count: settingsCount } = await supabaseAdmin
    .from("school_settings")
    .select("id", { count: "exact", head: true });

  if ((settingsCount ?? 0) === 0) {
    await supabaseAdmin.from("school_settings").insert({ name: "My School" });
  }
}