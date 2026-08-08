import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMe } from "@/hooks/use-me";
import { getSchoolSettingsFull } from "@/lib/auth.functions";
import {
  updateSchoolSettings,
  listClasses,
  createClassFn,
  deleteClassFn,
  listSubjects,
  createSubjectFn,
  deleteSubjectFn,
} from "@/lib/settings.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const STEPS = ["School profile", "Classes", "Subjects"];

function Onboarding() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (me && me.role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [me, navigate]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Set up your school</h1>
        <p className="text-sm text-muted-foreground">A few quick steps and you're ready to go.</p>
      </div>

      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2 flex-1">
            <div
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center text-xs font-semibold",
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn("text-xs", i === step ? "font-medium" : "text-muted-foreground")}>{s}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </li>
        ))}
      </ol>

      {step === 0 && <StepProfile onNext={() => setStep(1)} />}
      {step === 1 && <StepClasses onBack={() => setStep(0)} onNext={() => setStep(2)} />}
      {step === 2 && (
        <StepSubjects
          onBack={() => setStep(1)}
          onFinish={async () => {
            navigate({ to: "/dashboard", replace: true });
          }}
        />
      )}
    </div>
  );
}

function StepProfile({ onNext }: { onNext: () => void }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getSchoolSettingsFull);
  const updateFn = useServerFn(updateSchoolSettings);
  const { data: school } = useQuery({ queryKey: ["school"], queryFn: () => getFn() });
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    academic_year: "2025-26",
    board: "",
    principal_name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
  });

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name ?? "",
        academic_year: school.academic_year ?? "2025-26",
        board: school.board ?? "",
        principal_name: school.principal_name ?? "",
        phone: school.phone ?? "",
        email: school.email ?? "",
        address: school.address ?? "",
        city: school.city ?? "",
      });
    }
  }, [school]);

  async function save() {
    if (!form.name.trim()) return toast.error("School name is required");
    setBusy(true);
    try {
      await updateFn({ data: form });
      await qc.invalidateQueries({ queryKey: ["school"] });
      onNext();
    } catch (e: any) {
      toast.error(e.message ?? "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>Basic info shown on the portal header and reports.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <Field label="School name *">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Academic year">
          <Input value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} placeholder="2025-26" />
        </Field>
        <Field label="Board">
          <Input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} placeholder="CBSE / ICSE / State" />
        </Field>
        <Field label="Principal name">
          <Input value={form.principal_name} onChange={(e) => setForm({ ...form, principal_name: e.target.value })} />
        </Field>
        <Field label="Phone">
          <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="City" className="md:col-span-1">
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        </Field>
        <Field label="Address" className="md:col-span-2">
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </Field>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Next <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StepClasses({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listClasses);
  const createFn = useServerFn(createClassFn);
  const deleteFn = useServerFn(deleteClassFn);
  const { data: classes = [], isLoading } = useQuery({ queryKey: ["classes"], queryFn: () => listFn() });
  const [name, setName] = useState("");
  const [section, setSection] = useState("A");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return toast.error("Class name required");
    setBusy(true);
    try {
      await createFn({ data: { name, section } });
      setName("");
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classes</CardTitle>
        <CardDescription>Add each class & section (e.g. Class 1 – A). You can add more later.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Class name (e.g. Class 1)" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-32" />
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <div className="border rounded-md divide-y">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && classes.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No classes yet. Add your first one above.</div>
          )}
          {classes.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium text-sm">{c.name} – {c.section}</div>
                <div className="text-xs text-muted-foreground">{c.academic_year}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={onNext} disabled={classes.length === 0}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StepSubjects({ onBack, onFinish }: { onBack: () => void; onFinish: () => Promise<void> }) {
  const qc = useQueryClient();
  const listClassesFn = useServerFn(listClasses);
  const listFn = useServerFn(listSubjects);
  const createFn = useServerFn(createSubjectFn);
  const deleteFn = useServerFn(deleteSubjectFn);
  const updateFn = useServerFn(updateSchoolSettings);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listClassesFn() });
  const { data: subjects = [], isLoading } = useQuery({ queryKey: ["subjects"], queryFn: () => listFn() });
  const [classId, setClassId] = useState<string>("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    if (!classId && classes[0]) setClassId(classes[0].id);
  }, [classes, classId]);

  async function add() {
    if (!classId) return toast.error("Pick a class");
    if (!name.trim()) return toast.error("Subject name required");
    setBusy(true);
    try {
      await createFn({ data: { class_id: classId, name } });
      setName("");
      await qc.invalidateQueries({ queryKey: ["subjects"] });
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try { await deleteFn({ data: { id } }); await qc.invalidateQueries({ queryKey: ["subjects"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  async function finish() {
    setFinishing(true);
    try {
      await updateFn({ data: { onboarding_complete: true } });
      await qc.invalidateQueries({ queryKey: ["school"] });
      toast.success("All set! Welcome to your portal.");
      await onFinish();
    } catch (e: any) { toast.error(e.message); } finally { setFinishing(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects</CardTitle>
        <CardDescription>Add subjects for each class. You can refine these in Settings later.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="sm:w-56"><SelectValue placeholder="Pick a class" /></SelectTrigger>
            <SelectContent>
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name} – {c.section}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Subject name (e.g. Mathematics)" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <div className="border rounded-md divide-y">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && subjects.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No subjects yet.</div>
          )}
          {subjects.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium text-sm">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.classes ? `${s.classes.name} – ${s.classes.section}` : "—"}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(s.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-between">
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={finish} disabled={finishing}>
            {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Finish setup"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}