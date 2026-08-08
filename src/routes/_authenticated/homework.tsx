import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/format";
import { listClasses, listSubjects } from "@/lib/settings.functions";
import { createHomework, deleteHomework, listHomework } from "@/lib/homework.functions";

export const Route = createFileRoute("/_authenticated/homework")({ component: HomeworkPage });

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function HomeworkPage() {
  const { data: me } = useMe();
  const canPost = me?.role !== "parent" && me?.role !== "student";
  const listFn = useServerFn(listHomework);
  const classesFn = useServerFn(listClasses);
  const [classId, setClassId] = useState<string>("");
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const q = useQuery({ queryKey: ["homework", classId], queryFn: () => listFn({ data: { class_id: classId || undefined } }) });

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Homework</h1>
            <p className="text-muted-foreground text-sm">Daily assignments per class.</p>
          </div>
          {canPost && <PostDialog onCreated={() => q.refetch()} />}
        </div>

        <div className="flex gap-2">
          <Select value={classId || "all"} onValueChange={(v) => setClassId(v === "all" ? "" : v)}>
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(classesQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.section}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {(q.data ?? []).length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No homework.</CardContent></Card>}
          {(q.data ?? []).map((h: any) => <HomeworkCard key={h.id} h={h} canDelete={!!canPost} onDeleted={() => q.refetch()} />)}
        </div>
      </div>
    </>
  );
}

function HomeworkCard({ h, canDelete, onDeleted }: any) {
  const delFn = useServerFn(deleteHomework);
  const del = useMutation({ mutationFn: () => delFn({ data: { id: h.id } }), onSuccess: () => { toast.success("Deleted"); onDeleted(); } });
  return (
    <Card>
      <CardContent className="p-4 flex justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span className="font-medium text-foreground">{h.classes?.name} {h.classes?.section}</span>
            {h.subjects?.name && <>· <span>{h.subjects.name}</span></>}
            · <span>{formatDate(h.date)}</span>
            {h.due_date && <>· Due {formatDate(h.due_date)}</>}
          </div>
          <p className="text-sm whitespace-pre-wrap">{h.description}</p>
          {h.teachers?.profile?.full_name && <p className="text-xs text-muted-foreground mt-1">— {h.teachers.profile.full_name}</p>}
        </div>
        {canDelete && (
          <Button size="icon" variant="ghost" onClick={() => confirm("Delete?") && del.mutate()}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function PostDialog({ onCreated }: { onCreated: () => void }) {
  const classesFn = useServerFn(listClasses);
  const subjectsFn = useServerFn(listSubjects);
  const createFn = useServerFn(createHomework);
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => subjectsFn() });
  const [open, setOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(todayISO());
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("");
  const m = useMutation({
    mutationFn: () => createFn({ data: { class_id: classId, subject_id: subjectId || null, description: desc, date, due_date: dueDate || null } }),
    onSuccess: () => { toast.success("Posted"); setOpen(false); setDesc(""); setSubjectId(""); setDueDate(""); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Post</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Post homework</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Class</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
                <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>
                  {(classesQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.section}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(subjectsQ.data ?? []).filter((s: any) => s.class_id === classId).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Due</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Description</Label><Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={() => m.mutate()} disabled={!classId || !desc || m.isPending}>Post</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
