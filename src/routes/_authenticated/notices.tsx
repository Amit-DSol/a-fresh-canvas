import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pin, Trash2 } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/format";
import { createNotice, deleteNotice, listNotices, togglePinNotice } from "@/lib/notices.functions";

export const Route = createFileRoute("/_authenticated/notices")({ component: NoticesPage });

const ROLES = ["admin", "coordinator", "teacher", "parent", "student"];

function NoticesPage() {
  const { data: me } = useMe();
  const canPost = me?.role !== "parent" && me?.role !== "student";
  const canPin = me?.role === "admin" || me?.role === "coordinator";
  const listFn = useServerFn(listNotices);
  const q = useQuery({ queryKey: ["notices"], queryFn: () => listFn() });

  const filtered = (q.data ?? []).filter((n: any) =>
    !me?.role || n.target_roles.includes(me.role) || n.target_roles.length === 0,
  );

  return (
    <>
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Notices</h1>
            <p className="text-muted-foreground text-sm">Announcements for the school.</p>
          </div>
          {canPost && <PostDialog onCreated={() => q.refetch()} />}
        </div>
        <div className="space-y-2">
          {filtered.length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No notices.</CardContent></Card>}
          {filtered.map((n: any) => <NoticeCard key={n.id} n={n} canPin={!!canPin} canDelete={!!canPost} onChanged={() => q.refetch()} />)}
        </div>
      </div>
    </>
  );
}

function NoticeCard({ n, canPin, canDelete, onChanged }: any) {
  const pinFn = useServerFn(togglePinNotice);
  const delFn = useServerFn(deleteNotice);
  const pin = useMutation({ mutationFn: () => pinFn({ data: { id: n.id, is_pinned: !n.is_pinned } }), onSuccess: () => onChanged() });
  const del = useMutation({ mutationFn: () => delFn({ data: { id: n.id } }), onSuccess: () => { toast.success("Deleted"); onChanged(); } });
  return (
    <Card className={n.is_pinned ? "border-primary" : ""}>
      <CardContent className="p-4 flex gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {n.is_pinned && <Pin className="h-3 w-3 text-primary" />}
            <h3 className="font-semibold text-sm">{n.title}</h3>
          </div>
          <p className="text-sm whitespace-pre-wrap">{n.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{formatDate(n.created_at)}</span>
            {n.profiles?.full_name && <span>· {n.profiles.full_name}</span>}
            {n.target_roles.map((r: string) => <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>)}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {canPin && <Button size="icon" variant="ghost" onClick={() => pin.mutate()}><Pin className={`h-4 w-4 ${n.is_pinned ? "fill-current" : ""}`} /></Button>}
          {canDelete && <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate()}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </CardContent>
    </Card>
  );
}

function PostDialog({ onCreated }: { onCreated: () => void }) {
  const createFn = useServerFn(createNotice);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [roles, setRoles] = useState<string[]>(["parent", "student", "teacher"]);
  const m = useMutation({
    mutationFn: () => createFn({ data: { title, body, target_roles: roles, is_pinned: pinned } }),
    onSuccess: () => { toast.success("Posted"); setOpen(false); setTitle(""); setBody(""); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Notice</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Post notice</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-1"><Label>Body</Label><Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Audience</Label>
            <div className="flex flex-wrap gap-3">
              {ROLES.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm capitalize">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={(v) => setRoles((old) => v ? [...old, r] : old.filter((x) => x !== r))} />
                  {r}
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={pinned} onCheckedChange={(v) => setPinned(!!v)} /> Pin to top
          </label>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={!title || !body || m.isPending}>Post</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
