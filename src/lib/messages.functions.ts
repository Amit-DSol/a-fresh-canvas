import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, full_name, email")
      .neq("id", context.userId)
      .order("full_name")
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listInbox = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("messages")
      .select(
        "id, sender_id, recipient_id, body, is_read, created_at, " +
          "sender:profiles!messages_sender_id_fkey(full_name), recipient:profiles!messages_recipient_id_fkey(full_name)",
      )
      .or(`sender_id.eq.${context.userId},recipient_id.eq.${context.userId}`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { other_id: string }) => input)
  .handler(async ({ data, context }) => {
    const me = context.userId;
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, sender_id, recipient_id, body, is_read, created_at")
      .or(
        `and(sender_id.eq.${me},recipient_id.eq.${data.other_id}),and(sender_id.eq.${data.other_id},recipient_id.eq.${me})`,
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    await context.supabase
      .from("messages")
      .update({ is_read: true })
      .eq("recipient_id", me)
      .eq("sender_id", data.other_id)
      .eq("is_read", false);
    return rows ?? [];
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient_id: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const body = data.body.trim();
    if (!body) throw new Error("Empty message");
    const { data: row, error } = await context.supabase
      .from("messages")
      .insert({ sender_id: context.userId, recipient_id: data.recipient_id, body })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
