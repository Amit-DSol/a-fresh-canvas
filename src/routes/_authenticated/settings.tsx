import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
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
  listUsers,
  updateUserRole,
} from "@/lib/settings.functions";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && me && me.role !== "admin") navigate({ to: "/dashboard", replace: true });
  }, [me, isLoading, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your school, classes, subjects and users.</p>
      </div>
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">School profile</TabsTrigger>
          <TabsTrigger value="classes">Classes</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="users">Users & roles</TabsTrigger>
        </TabsList>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="classes"><ClassesTab /></TabsContent>
        <TabsContent value="subjects"><SubjectsTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getSchoolSettingsFull);
  const updateFn = useServerFn(updateSchoolSettings);
  const { data: school } = useQuery({ queryKey: ["school"], queryFn: () => getFn() });
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (school && !form) {
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
  }, [school, form]);

  if (!form) return <div className="text-sm text-muted-foreground">Loading…</div>;

  async function save() {
    setBusy(true);
    try {
      await updateFn({ data: form });
      await qc.invalidateQueries({ queryKey: ["school"] });
      toast.success("Saved");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School profile</CardTitle>
        <CardDescription>Shown on reports, report cards and the portal header.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        {[
          ["name", "School name *"],
          ["academic_year", "Academic year"],
          ["board", "Board"],
          ["principal_name", "Principal"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["city", "City"],
        ].map(([k, label]) => (
          <div key={k} className="space-y-1.5">
            <Label>{label}</Label>
            <Input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </div>
        ))}
        <div className="space-y-1.5 md:col-span-2">
          <Label>Address</Label>
          <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="md:col-span-2 flex justify-end">
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ClassesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listClasses);
  const createFn = useServerFn(createClassFn);
  const deleteFn = useServerFn(deleteClassFn);
  const { data: classes = [], isLoading } = useQuery({ queryKey: ["classes"], queryFn: () => listFn() });
  const [name, setName] = useState("");
  const [section, setSection] = useState("A");

  async function add() {
    if (!name.trim()) return toast.error("Class name required");
    try {
      await createFn({ data: { name, section } });
      setName("");
      await qc.invalidateQueries({ queryKey: ["classes"] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this class?")) return;
    try { await deleteFn({ data: { id } }); await qc.invalidateQueries({ queryKey: ["classes"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Classes</CardTitle>
        <CardDescription>Each class+section is unique. Used for students, attendance and timetable.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Section" value={section} onChange={(e) => setSection(e.target.value)} className="sm:w-32" />
          <Button onClick={add}><Plus className="h-4 w-4" /> Add class</Button>
        </div>
        <div className="border rounded-md divide-y">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && classes.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No classes yet.</div>
          )}
          {classes.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium text-sm">{c.name} – {c.section}</div>
                <div className="text-xs text-muted-foreground">{c.academic_year} · added {formatDate(c.created_at)}</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SubjectsTab() {
  const qc = useQueryClient();
  const listClassesFn = useServerFn(listClasses);
  const listFn = useServerFn(listSubjects);
  const createFn = useServerFn(createSubjectFn);
  const deleteFn = useServerFn(deleteSubjectFn);
  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => listClassesFn() });
  const { data: subjects = [], isLoading } = useQuery({ queryKey: ["subjects"], queryFn: () => listFn() });
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => { if (!classId && classes[0]) setClassId(classes[0].id); }, [classes, classId]);

  async function add() {
    if (!classId) return toast.error("Pick a class");
    if (!name.trim()) return toast.error("Subject name required");
    try {
      await createFn({ data: { class_id: classId, name, code } });
      setName(""); setCode("");
      await qc.invalidateQueries({ queryKey: ["subjects"] });
    } catch (e: any) { toast.error(e.message); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this subject?")) return;
    try { await deleteFn({ data: { id } }); await qc.invalidateQueries({ queryKey: ["subjects"] }); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects</CardTitle>
        <CardDescription>Subjects belong to a class. Used for exams, marks and timetable.</CardDescription>
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
          <Input placeholder="Subject name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Code (optional)" value={code} onChange={(e) => setCode(e.target.value)} className="sm:w-40" />
          <Button onClick={add}><Plus className="h-4 w-4" /> Add</Button>
        </div>
        <div className="border rounded-md divide-y">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && subjects.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">No subjects yet.</div>
          )}
          {subjects.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between p-3">
              <div>
                <div className="font-medium text-sm">{s.name}{s.code ? ` (${s.code})` : ""}</div>
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
      </CardContent>
    </Card>
  );
}

const ROLES = ["admin", "coordinator", "teacher", "parent", "student"] as const;

function UsersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listUsers);
  const updateFn = useServerFn(updateUserRole);
  const { data: users = [], isLoading } = useQuery({ queryKey: ["users"], queryFn: () => listFn() });

  async function setRole(user_id: string, role: any) {
    try { await updateFn({ data: { user_id, role } }); await qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Role updated"); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users & roles</CardTitle>
        <CardDescription>Anyone who signs up appears here. Assign their role to grant access.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && users.length === 0 && (
          <div className="text-sm text-muted-foreground">No users yet.</div>
        )}
        <div className="border rounded-md divide-y">
          {users.map((u: any) => (
            <div key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3">
              <div>
                <div className="font-medium text-sm">{u.full_name || u.email}</div>
                <div className="text-xs text-muted-foreground">{u.email} · joined {formatDate(u.created_at)}</div>
                <div className="mt-1 flex gap-1">
                  {(u.roles ?? []).map((r: string) => (
                    <Badge key={r} variant="secondary" className="text-[10px]">{r}</Badge>
                  ))}
                </div>
              </div>
              <Select value={u.roles?.[0] ?? ""} onValueChange={(v) => setRole(u.id, v)}>
                <SelectTrigger className="sm:w-44"><SelectValue placeholder="Assign role" /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}