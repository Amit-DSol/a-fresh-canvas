import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hasAnyRole(supabase: any, userId: string, roles: string[]) {
  for (const r of roles) {
    const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: r });
    if (data) return true;
  }
  return false;
}

export const listNotices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notices")
      .select("id, title, body, target_roles, is_pinned, created_at, created_by, profiles:profiles!notices_created_by_fkey(full_name)")
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { title: string; body: string; target_roles: string[]; is_pinned?: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!(await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator", "teacher"])))
      throw new Error("Forbidden");
    const { data: row, error } = await context.supabase
      .from("notices")
      .insert({
        title: data.title,
        body: data.body,
        target_roles: data.target_roles,
        is_pinned: !!data.is_pinned,
        created_by: context.userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const togglePinNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; is_pinned: boolean }) => input)
  .handler(async ({ data, context }) => {
    if (!(await hasAnyRole(context.supabase, context.userId, ["admin", "coordinator"])))
      throw new Error("Forbidden");
    const { error } = await context.supabase.from("notices").update({ is_pinned: data.is_pinned }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("notices").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
