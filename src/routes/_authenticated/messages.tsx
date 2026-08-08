import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMe } from "@/hooks/use-me";
import { listContacts, listInbox, listThread, sendMessage } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/messages")({
  component: MessagesPage,
  validateSearch: (search: Record<string, unknown>): { to?: string } =>
    typeof search.to === "string" ? { to: search.to } : {},
});

function MessagesPage() {
  const { data: me } = useMe();
  const { to } = Route.useSearch();
  const inboxFn = useServerFn(listInbox);
  const contactsFn = useServerFn(listContacts);
  const inboxQ = useQuery({ queryKey: ["inbox"], queryFn: () => inboxFn() });
  const contactsQ = useQuery({ queryKey: ["contacts"], queryFn: () => contactsFn() });
  const [otherId, setOtherId] = useState<string>(to ?? "");
  const [search, setSearch] = useState("");

  const conversations = new Map<string, any>();
  (inboxQ.data ?? []).forEach((m: any) => {
    const other = m.sender_id === me?.userId ? m.recipient_id : m.sender_id;
    const otherName = (m.sender_id === me?.userId ? m.recipient?.full_name : m.sender?.full_name) ?? "—";
    if (!conversations.has(other)) conversations.set(other, { other, otherName, last: m });
  });

  const filteredContacts = (contactsQ.data ?? []).filter((c: any) =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Messages</h1>
          <p className="text-muted-foreground text-sm">Direct conversations.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          <Card className="p-3 space-y-2">
            <Input placeholder="Search contacts…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-[60vh] overflow-y-auto space-y-1">
              {[...conversations.values()].map((c) => (
                <button key={c.other} onClick={() => setOtherId(c.other)} className={`w-full text-left p-2 rounded-md text-sm ${otherId === c.other ? "bg-accent" : "hover:bg-accent/50"}`}>
                  <div className="font-medium">{c.otherName}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.last.body}</div>
                </button>
              ))}
              {search && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground px-2 py-1">Contacts</div>
                  {filteredContacts.map((c: any) => (
                    <button key={c.id} onClick={() => { setOtherId(c.id); setSearch(""); }} className="w-full text-left p-2 rounded-md text-sm hover:bg-accent/50">
                      {c.full_name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <Card>{otherId ? <Thread otherId={otherId} me={me?.userId ?? ""} /> : <CardContent className="py-16 text-center text-muted-foreground">Select or search for someone to message.</CardContent>}</Card>
        </div>
      </div>
    </>
  );
}

function Thread({ otherId, me }: { otherId: string; me: string }) {
  const qc = useQueryClient();
  const threadFn = useServerFn(listThread);
  const sendFn = useServerFn(sendMessage);
  const q = useQuery({ queryKey: ["thread", otherId], queryFn: () => threadFn({ data: { other_id: otherId } }) });
  const [text, setText] = useState("");
  const send = useMutation({
    mutationFn: () => sendFn({ data: { recipient_id: otherId, body: text } }),
    onSuccess: () => { setText(""); qc.invalidateQueries({ queryKey: ["thread", otherId] }); qc.invalidateQueries({ queryKey: ["inbox"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {(q.data ?? []).map((m: any) => (
          <div key={m.id} className={`flex ${m.sender_id === me ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${m.sender_id === me ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              <div className="whitespace-pre-wrap">{m.body}</div>
              <div className="text-[10px] opacity-70 mt-1">{new Date(m.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {(q.data ?? []).length === 0 && <div className="text-center text-muted-foreground text-sm py-10">Say hi 👋</div>}
      </div>
      <div className="p-3 border-t flex gap-2">
        <Textarea rows={1} className="min-h-0 resize-none" value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); text.trim() && send.mutate(); } }} />
        <Button onClick={() => text.trim() && send.mutate()} disabled={!text.trim() || send.isPending}>Send</Button>
      </div>
    </div>
  );
}
