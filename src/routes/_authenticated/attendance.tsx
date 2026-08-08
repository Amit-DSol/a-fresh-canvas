import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { useMe } from "@/hooks/use-me";
import {
  attendanceReport,
  listStudentsForAttendance,
  listTeacherClasses,
  saveAttendance,
} from "@/lib/attendance.functions";

export const Route = createFileRoute("/_authenticated/attendance")({
  component: AttendancePage,
});

type Status = "present" | "absent" | "late" | "holiday";
const STATUSES: Status[] = ["present", "absent", "late", "holiday"];
const LABEL: Record<Status, string> = {
  present: "P",
  absent: "A",
  late: "L",
  holiday: "H",
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AttendancePage() {
  const { data: me } = useMe();
  const canReport = me?.role === "admin" || me?.role === "coordinator";
  return (
    <>
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground text-sm">Mark daily attendance and view reports.</p>
        </div>
        <Tabs defaultValue="mark">
          <TabsList>
            <TabsTrigger value="mark">Mark</TabsTrigger>
            {canReport && <TabsTrigger value="report">Reports</TabsTrigger>}
          </TabsList>
          <TabsContent value="mark" className="mt-4">
            <MarkTab />
          </TabsContent>
          {canReport && (
            <TabsContent value="report" className="mt-4">
              <ReportTab />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
}

function MarkTab() {
  const classesFn = useServerFn(listTeacherClasses);
  const listFn = useServerFn(listStudentsForAttendance);
  const saveFn = useServerFn(saveAttendance);
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [rows, setRows] = useState<Record<string, Status>>({});

  const classesQ = useQuery({ queryKey: ["att-classes"], queryFn: () => classesFn() });
  const studentsQ = useQuery({
    queryKey: ["att-students", classId, date],
    queryFn: () => listFn({ data: { class_id: classId, date } }),
    enabled: !!classId && !!date,
  });

  const students = studentsQ.data ?? [];

  const save = useMutation({
    mutationFn: async () => {
      const entries = students.map((s: any) => ({
        student_id: s.id,
        status: (rows[s.id] ?? s.status ?? "present") as Status,
      }));
      return saveFn({ data: { class_id: classId, date, entries } });
    },
    onSuccess: () => {
      toast.success("Attendance saved");
      setRows({});
      qc.invalidateQueries({ queryKey: ["att-students", classId, date] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  function setAll(s: Status) {
    const next: Record<string, Status> = {};
    students.forEach((st: any) => (next[st.id] = s));
    setRows(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Register</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={() => setAll("present")} disabled={!students.length}>
              All P
            </Button>
            <Button variant="outline" onClick={() => setAll("holiday")} disabled={!students.length}>
              Holiday
            </Button>
          </div>
        </div>

        {classId && (
          <>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Roll</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-72">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No students in this class.
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((s: any) => {
                      const current = (rows[s.id] ?? s.status ?? "present") as Status;
                      return (
                        <TableRow key={s.id}>
                          <TableCell>{s.roll_number ?? "—"}</TableCell>
                          <TableCell>{s.full_name}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {STATUSES.map((st) => (
                                <Button
                                  key={st}
                                  size="sm"
                                  variant={current === st ? "default" : "outline"}
                                  onClick={() => setRows((r) => ({ ...r, [s.id]: st }))}
                                >
                                  {LABEL[st]}
                                </Button>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => save.mutate()} disabled={save.isPending || !students.length}>
                {save.isPending ? "Saving..." : "Save Attendance"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ReportTab() {
  const classesFn = useServerFn(listTeacherClasses);
  const reportFn = useServerFn(attendanceReport);
  const [classId, setClassId] = useState<string>("");
  const today = todayISO();
  const monthAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);

  const classesQ = useQuery({ queryKey: ["att-classes"], queryFn: () => classesFn() });
  const reportQ = useQuery({
    queryKey: ["att-report", classId, from, to],
    queryFn: () => reportFn({ data: { class_id: classId || undefined, from, to } }),
    enabled: !!from && !!to,
  });

  const rows = reportQ.data ?? [];

  const summary = useMemo(() => {
    const s = { present: 0, absent: 0, late: 0, holiday: 0 };
    rows.forEach((r: any) => ((s as any)[r.status] += 1));
    return s;
  }, [rows]);

  function exportCsv() {
    const header = ["Date", "Class", "Roll", "Student", "Status", "Note"];
    const lines = [header.join(",")];
    rows.forEach((r: any) => {
      const cls = r.classes ? `${r.classes.name} ${r.classes.section}` : "";
      const name = r.students?.profile?.full_name ?? "";
      const roll = r.students?.roll_number ?? "";
      lines.push(
        [formatDate(r.date), cls, roll, name, r.status, (r.note ?? "").replace(/,/g, ";")]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(","),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Report</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId || "all"} onValueChange={(v) => setClassId(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {(classesQ.data ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Present: {summary.present}</Badge>
          <Badge variant="secondary">Absent: {summary.absent}</Badge>
          <Badge variant="secondary">Late: {summary.late}</Badge>
          <Badge variant="secondary">Holiday: {summary.holiday}</Badge>
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Roll</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No records.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>
                      {r.classes ? `${r.classes.name} ${r.classes.section}` : "—"}
                    </TableCell>
                    <TableCell>{r.students?.roll_number ?? "—"}</TableCell>
                    <TableCell>{r.students?.profile?.full_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{r.status}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}