import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, X, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { listClasses, listSubjects } from "@/lib/settings.functions";
import {
  listTeachers, createTeacher, deleteTeacher,
  assignTeacherClass, removeTeacherClass,
  assignTeacherSubject, removeTeacherSubject,
  resetFirstLogin,
} from "@/lib/people.functions";


export const Route = createFileRoute("/_authenticated/teachers")({
  component: TeachersPage,
});

function TeachersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTeachers);
  const listClassesFn = useServerFn(listClasses);
  const listSubjectsFn = useServerFn(listSubjects);
  const { data: teachers = [], isLoading } = useQuery({ queryKey: ["teachers"], queryFn: () => listFn() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listClassesFn() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => listSubjectsFn() });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground">{teachers.length} total</p>
        </div>
        <AddTeacherDialog onDone={() => qc.invalidateQueries({ queryKey: ["teachers"] })} />
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && teachers.length === 0 && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">No teachers yet.</CardContent></Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(teachers as any[]).map((t) => (
          <TeacherCard
            key={t.id} t={t}
            classes={classes as any[]}
            subjects={subjects as any[]}
            onChange={() => qc.invalidateQueries({ queryKey: ["teachers"] })}
          />
        ))}
      </div>
    </div>
  );
}

function TeacherCard({ t, classes, subjects, onChange }: { t: any; classes: any[]; subjects: any[]; onChange: () => void }) {
  const delFn = useServerFn(deleteTeacher);
  const assignClassFn = useServerFn(assignTeacherClass);
  const removeClassFn = useServerFn(removeTeacherClass);
  const assignSubFn = useServerFn(assignTeacherSubject);
  const removeSubFn = useServerFn(removeTeacherSubject);
  const resendFn = useServerFn(resetFirstLogin);


  const [newClass, setNewClass] = useState("");
  const [isCT, setIsCT] = useState(false);
  const [subClass, setSubClass] = useState("");
  const [subId, setSubId] = useState("");

  async function addClass() {
    if (!newClass) return;
    try { await assignClassFn({ data: { teacher_id: t.id, class_id: newClass, is_class_teacher: isCT } }); setNewClass(""); setIsCT(false); onChange(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function addSubject() {
    if (!subClass || !subId) return;
    try { await assignSubFn({ data: { teacher_id: t.id, class_id: subClass, subject_id: subId } }); setSubId(""); onChange(); }
    catch (e: any) { toast.error(e.message); }
  }
  async function remove() {
    if (!confirm("Remove this teacher? Login is preserved.")) return;
    try { await delFn({ data: { id: t.id } }); onChange(); } catch (e: any) { toast.error(e.message); }
  }

  const subsForClass = subjects.filter((s) => s.class_id === subClass);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="text-base">{t.profile?.full_name ?? "—"}</CardTitle>
          <CardDescription className="text-xs">
            {t.profile?.email}
            {t.employee_id ? ` · ${t.employee_id}` : ""}
            {t.is_coordinator && <Badge variant="secondary" className="ml-2 text-[10px]">Coordinator</Badge>}
          </CardDescription>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Reset first login"
            onClick={async () => {
              try {
                await resendFn({ data: { user_id: t.profile.id } });
                toast.success("First-login reset — they can set a new password at sign-in");
              } catch (e: any) { toast.error(e.message); }
            }}
          >
            <Mail className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={remove}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Classes</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(t.teacher_classes ?? []).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            {(t.teacher_classes ?? []).map((tc: any) => (
              <Badge key={tc.id} variant="outline" className="gap-1">
                {tc.classes?.name} – {tc.classes?.section}{tc.is_class_teacher && " · CT"}
                <button onClick={async () => { await removeClassFn({ data: { id: tc.id } }); onChange(); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 items-center">
            <Select value={newClass} onValueChange={setNewClass}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Add class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>)}
              </SelectContent>
            </Select>
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <Checkbox checked={isCT} onCheckedChange={(v) => setIsCT(!!v)} /> CT
            </label>
            <Button size="sm" onClick={addClass}>Add</Button>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">Subjects</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(t.teacher_subjects ?? []).length === 0 && <span className="text-xs text-muted-foreground">None</span>}
            {(t.teacher_subjects ?? []).map((ts: any) => (
              <Badge key={ts.id} variant="outline" className="gap-1">
                {ts.subjects?.name} ({ts.classes?.name}–{ts.classes?.section})
                <button onClick={async () => { await removeSubFn({ data: { id: ts.id } }); onChange(); }}>
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Select value={subClass} onValueChange={(v) => { setSubClass(v); setSubId(""); }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={subId} onValueChange={setSubId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent>
                {subsForClass.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={addSubject}>Add</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddTeacherDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createTeacher);
  const [f, setF] = useState({ full_name: "", email: "", phone: "", employee_id: "", is_coordinator: false });

  async function submit() {
    if (!f.full_name.trim() || !f.email.trim()) return toast.error("Name and email required");
    setBusy(true);
    try {
      await createFn({ data: f });
      toast.success("Teacher added");
      setOpen(false);
      setF({ full_name: "", email: "", phone: "", employee_id: "", is_coordinator: false });
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Add teacher</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add teacher</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label className="text-xs">Full name *</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Email *</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div className="space-y-1.5"><Label className="text-xs">Employee ID</Label><Input value={f.employee_id} onChange={(e) => setF({ ...f, employee_id: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={f.is_coordinator} onCheckedChange={(v) => setF({ ...f, is_coordinator: !!v })} />
            Also grant Coordinator role
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add teacher"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}