import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Search, UserPlus, Mail, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useMe } from "@/hooks/use-me";
import {
  listStudents, createStudent, deleteStudent,
  listClassesForStudentManagement,
  addGuardian, removeGuardian, resetFirstLogin,
} from "@/lib/people.functions";
import { formatDate } from "@/lib/format";
import { ImportStudentsDialog } from "@/components/import-students-dialog";


export const Route = createFileRoute("/_authenticated/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const listFn = useServerFn(listStudents);
  const mgmtFn = useServerFn(listClassesForStudentManagement);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students"], queryFn: () => listFn(),
  });
  const { data: mgmt } = useQuery({
    queryKey: ["classes-for-mgmt"], queryFn: () => mgmtFn(),
  });
  const manageableClasses = mgmt?.classes ?? [];
  const manageableIds = useMemo(() => new Set(manageableClasses.map((c: any) => c.id)), [manageableClasses]);
  const canManageAny = manageableClasses.length > 0;

  const [q, setQ] = useState("");
  const [classFilter, setClassFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return (students as any[]).filter((s) => {
      if (classFilter !== "all" && s.class_id !== classFilter) return false;
      if (!q) return true;
      const hay = `${s.profile?.full_name ?? ""} ${s.profile?.email ?? ""} ${s.admission_number ?? ""} ${s.roll_number ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [students, q, classFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">{students.length} total</p>
        </div>
        {canManageAny && (
          <div className="flex gap-2">
            <ImportStudentsDialog
              classes={manageableClasses}
              onDone={() => qc.invalidateQueries({ queryKey: ["students"] })}
            />
            <AddStudentDialog
              classes={manageableClasses}
              onDone={() => qc.invalidateQueries({ queryKey: ["students"] })}
            />
          </div>
        )}

      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, admission, roll…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {(mgmt?.canManageAll ? manageableClasses : manageableClasses).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No students match.{canManageAny && " Click Add student to create one."}
            </div>
          )}
          <div className="divide-y">
            {filtered.map((s: any) => (
              <StudentRow
                key={s.id}
                s={s}
                canManage={manageableIds.has(s.class_id)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentRow({ s, canManage }: { s: any; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const delFn = useServerFn(deleteStudent);
  const resendFn = useServerFn(resetFirstLogin);

  async function del() {
    if (!confirm("Remove this student? Their login is not deleted.")) return;
    try {
      await delFn({ data: { id: s.id } });
      await qc.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function resend() {
    try {
      await resendFn({ data: { user_id: s.profile.id } });
      toast.success("First-login reset — they can set a new password at sign-in");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div>
      <div className="flex items-center gap-3 p-3">
        <button
          className="text-muted-foreground hover:text-foreground"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Collapse" : "Expand"}
        >
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
          {(s.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{s.profile?.full_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">
            {s.classes ? `${s.classes.name} – ${s.classes.section}` : "Unassigned"}
            {s.admission_number ? ` · #${s.admission_number}` : ""}
            {s.roll_number ? ` · Roll ${s.roll_number}` : ""}
          </div>
        </div>
        {s.date_of_birth && (
          <Badge variant="secondary" className="text-[10px] hidden sm:inline-flex">
            DOB {formatDate(s.date_of_birth)}
          </Badge>
        )}
        {canManage && (
          <>
            <Button variant="ghost" size="icon" onClick={resend} title="Reset first login">
              <Mail className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={del} aria-label="Delete">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
      {open && (
        <div className="bg-muted/30 px-6 py-4 border-t">
          <GuardianPanel student={s} canManage={canManage} />
        </div>
      )}
    </div>
  );
}

function GuardianPanel({ student, canManage }: { student: any; canManage: boolean }) {
  const qc = useQueryClient();
  const removeFn = useServerFn(removeGuardian);
  const resendFn = useServerFn(resetFirstLogin);
  const guardians = (student.guardians ?? []) as any[];

  async function remove(id: string) {
    if (!confirm("Remove this guardian? Their login is preserved.")) return;
    try {
      await removeFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["students"] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function resend(userId: string) {
    try {
      await resendFn({ data: { user_id: userId } });
      toast.success("First-login reset — they can set a new password at sign-in");
    } catch (e: any) { toast.error(e.message); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Guardians</div>
        {canManage && (
          <AddGuardianDialog
            studentId={student.id}
            onDone={() => qc.invalidateQueries({ queryKey: ["students"] })}
          />
        )}
      </div>
      {guardians.length === 0 ? (
        <div className="text-xs text-muted-foreground">No guardians linked yet.</div>
      ) : (
        <div className="grid gap-2">
          {guardians.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-md border bg-background p-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {g.parent?.full_name ?? "—"}{" "}
                  <span className="text-xs font-normal text-muted-foreground capitalize">
                    · {g.relation}{g.is_primary && " · primary"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {g.parent?.email}
                  {g.phone ? ` · ${g.phone}` : ""}
                </div>
              </div>
              {canManage && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => resend(g.parent.id)} title="Reset first login">
                    <Mail className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(g.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddGuardianDialog({ studentId, onDone }: { studentId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const addFn = useServerFn(addGuardian);
  const [f, setF] = useState<{
    relation: "mother" | "father" | "guardian";
    full_name: string;
    email: string;
    phone: string;
    is_primary: boolean;
  }>({ relation: "guardian", full_name: "", email: "", phone: "", is_primary: false });

  async function submit() {
    if (!f.full_name.trim() || !f.email.trim()) return toast.error("Name and email required");
    setBusy(true);
    try {
      await addFn({ data: { student_id: studentId, ...f } });
      toast.success("Guardian added — invite email sent");
      setOpen(false);
      setF({ relation: "guardian", full_name: "", email: "", phone: "", is_primary: false });
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><UserPlus className="h-4 w-4" /> Add guardian</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add guardian</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Relation">
            <Select value={f.relation} onValueChange={(v: any) => setF({ ...f, relation: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mother">Mother</SelectItem>
                <SelectItem value="father">Father</SelectItem>
                <SelectItem value="guardian">Guardian</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Full name *"><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field label="Email *"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={f.is_primary} onChange={(e) => setF({ ...f, is_primary: e.target.checked })} />
            Set as primary guardian
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add guardian"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStudentDialog({ classes, onDone }: { classes: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const createFn = useServerFn(createStudent);
  const [f, setF] = useState({
    full_name: "", email: "", admission_number: "", roll_number: "",
    class_id: classes[0]?.id ?? "", date_of_birth: "", gender: "",
    mother_full_name: "", mother_email: "", mother_phone: "",
    father_full_name: "", father_email: "", father_phone: "",
  });

  function set<K extends keyof typeof f>(k: K, v: string) { setF((p) => ({ ...p, [k]: v })); }

  async function submit() {
    if (!f.full_name.trim() || !f.email.trim()) return toast.error("Name and email required");
    if (!f.class_id) return toast.error("Pick a class");
    setBusy(true);
    try {
      await createFn({
        data: {
          full_name: f.full_name,
          email: f.email,
          admission_number: f.admission_number,
          roll_number: f.roll_number,
          class_id: f.class_id,
          date_of_birth: f.date_of_birth,
          gender: f.gender,
          mother: f.mother_email
            ? { full_name: f.mother_full_name, email: f.mother_email, phone: f.mother_phone }
            : undefined,
          father: f.father_email
            ? { full_name: f.father_full_name, email: f.father_email, phone: f.father_phone }
            : undefined,
        },
      });
      toast.success("Student added — invite email sent");
      setOpen(false);
      setF({
        full_name: "", email: "", admission_number: "", roll_number: "",
        class_id: classes[0]?.id ?? "", date_of_birth: "", gender: "",
        mother_full_name: "", mother_email: "", mother_phone: "",
        father_full_name: "", father_email: "", father_phone: "",
      });
      onDone();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" /> Add student</Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add student</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name *"><Input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} /></Field>
          <Field label="Email *"><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Admission #"><Input value={f.admission_number} onChange={(e) => set("admission_number", e.target.value)} /></Field>
          <Field label="Roll #"><Input value={f.roll_number} onChange={(e) => set("roll_number", e.target.value)} /></Field>
          <Field label="Class *">
            <Select value={f.class_id} onValueChange={(v) => set("class_id", v)}>
              <SelectTrigger><SelectValue placeholder="Pick a class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Date of birth"><Input type="date" value={f.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} /></Field>
          <Field label="Gender">
            <Select value={f.gender} onValueChange={(v) => set("gender", v)}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <div className="sm:col-span-2 pt-2 border-t mt-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Mother (optional)</div>
          </div>
          <Field label="Name"><Input value={f.mother_full_name} onChange={(e) => set("mother_full_name", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={f.mother_email} onChange={(e) => set("mother_email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.mother_phone} onChange={(e) => set("mother_phone", e.target.value)} /></Field>

          <div className="sm:col-span-2 pt-2 border-t mt-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Father (optional)</div>
          </div>
          <Field label="Name"><Input value={f.father_full_name} onChange={(e) => set("father_full_name", e.target.value)} /></Field>
          <Field label="Email"><Input type="email" value={f.father_email} onChange={(e) => set("father_email", e.target.value)} /></Field>
          <Field label="Phone"><Input value={f.father_phone} onChange={(e) => set("father_phone", e.target.value)} /></Field>
        </div>
        <p className="text-xs text-muted-foreground pt-2">
          Each person with an email will get an invite to set their own password.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Saving…" : "Add student"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>;
}
