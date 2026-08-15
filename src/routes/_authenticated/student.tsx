import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, MessageSquare, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/format";
import { myAttendance } from "@/lib/attendance.functions";
import { myResults } from "@/lib/exams.functions";
import { myClassHomework } from "@/lib/homework.functions";
import { myStudentInfo } from "@/lib/student.functions";
import { listTimetable } from "@/lib/timetable.functions";
import { listExamSchedule } from "@/lib/exams.functions";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/student")({
  validateSearch: (search: Record<string, unknown>): { student?: string } => ({
    student: typeof search.student === "string" && search.student ? search.student : undefined,
  }),
  component: StudentPortal,
});

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("") || "?";
}
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
function fmtTime(t?: string | null) {
  if (!t) return null;
  const [h, m] = t.split(":");
  const hh = Number(h);
  const ampm = hh >= 12 ? "PM" : "AM";
  return `${((hh + 11) % 12) + 1}:${m} ${ampm}`;
}

function StudentPortal() {
  const { data: me } = useMe();
  const { student: childId } = Route.useSearch();
  const infoFn = useServerFn(myStudentInfo);
  const attFn = useServerFn(myAttendance);
  const resFn = useServerFn(myResults);
  const hwFn = useServerFn(myClassHomework);
  const ttFn = useServerFn(listTimetable);
  const examFn = useServerFn(listExamSchedule);
  const resultsRef = useRef<HTMLDivElement>(null);

  const infoQ = useQuery({
    queryKey: ["my-student-info", childId ?? "self"],
    queryFn: () => infoFn({ data: childId ? { student_id: childId } : {} }),
  });
  const denied = (infoQ.data as any)?.denied === true;
  const info: any = denied ? null : infoQ.data;
  const childProfileId: string | undefined = childId ? info?.profile_id : undefined;
  const scoped = childId ? { student_profile_id: childProfileId } : {};
  const dataEnabled = childId ? !!childProfileId : true;

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  const attQ = useQuery({
    queryKey: ["my-att", childId ?? "self", iso(monthStart), iso(monthEnd)],
    queryFn: () => attFn({ data: { from: iso(monthStart), to: iso(monthEnd), ...scoped } }),
    enabled: dataEnabled,
  });
  const resQ = useQuery({
    queryKey: ["my-res", childId ?? "self"],
    queryFn: () => resFn({ data: { ...scoped } }),
    enabled: dataEnabled,
  });
  const hwQ = useQuery({
    queryKey: ["my-hw", childId ?? "self"],
    queryFn: () => hwFn({ data: { ...scoped } }),
    enabled: dataEnabled,
  });

  const classId: string | undefined = info?.class_id ?? undefined;
  const ttQ = useQuery({
    queryKey: ["my-timetable", classId],
    queryFn: () => ttFn({ data: { class_id: classId! } }),
    enabled: !!classId,
  });
  const examQ = useQuery({
    queryKey: ["my-exam-schedule", classId],
    queryFn: () => examFn({ data: { class_id: classId! } }),
    enabled: !!classId,
  });
  const timetableByDay = useMemo(() => {
    const m = new Map<number, any[]>();
    (ttQ.data ?? []).forEach((r: any) => {
      const list = m.get(r.day_of_week) ?? [];
      list.push(r);
      m.set(r.day_of_week, list);
    });
    return m;
  }, [ttQ.data]);

  const byDate = useMemo(() => {
    const m = new Map<string, string>();
    (attQ.data ?? []).forEach((r: any) => m.set(r.date, r.status));
    return m;
  }, [attQ.data]);

  const summary = { present: 0, absent: 0, late: 0, holiday: 0 };
  (attQ.data ?? []).forEach((r: any) => ((summary as any)[r.status] += 1));
  const marked = summary.present + summary.absent + summary.late;
  const pct = marked > 0 ? Math.round((summary.present / marked) * 100) : null;

  async function downloadReportCard() {
    const el = resultsRef.current;
    if (!el) return;
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "pt", format: "a4" });
    const w = pdf.internal.pageSize.getWidth();
    const h = (canvas.height * w) / canvas.width;
    pdf.addImage(img, "PNG", 0, 0, w, h);
    pdf.save(`report-card-${me?.profile?.full_name ?? "student"}.pdf`);
  }

  // Calendar grid: leading blanks + days of month
  const firstWeekday = monthStart.getDay(); // 0=Sun
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const displayName = info?.full_name ?? (childId ? "Student" : me?.profile?.full_name ?? "Student");
  const classLabel = info?.class_name
    ? `${info.class_name}${info.class_section ? ` – ${info.class_section}` : ""}`
    : null;

  if (denied) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Access denied</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This student isn’t linked to your account, so you can’t view their profile.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/parent"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Parent Portal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-4">
        {childId && (
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/parent"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Parent Portal</Link>
          </Button>
        )}
        {/* Profile header */}
        <Card>
          <CardContent className="p-4 flex items-center gap-4 flex-wrap">
            <div className="h-14 w-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold shrink-0">
              {initials(displayName)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold truncate">{displayName}</div>
              <div className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {classLabel && <span>{classLabel}</span>}
                {info?.roll_number && <span>Roll: {info.roll_number}</span>}
                {info?.admission_number && <span>Adm: {info.admission_number}</span>}
              </div>
            </div>
            {info?.class_teacher && (
              <Button asChild size="sm" variant="outline">
                <Link to="/messages" search={{ to: info.class_teacher.profile_id }}>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Message {info.class_teacher.full_name}
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["present","absent","late","holiday"] as const).map((k) => (
            <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground capitalize">{k}</div><div className="text-2xl font-bold">{(summary as any)[k]}</div></CardContent></Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Recent Homework</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(hwQ.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">No homework.</div>}
              {(hwQ.data ?? []).slice(0, 10).map((h: any) => (
                <div key={h.id} className="border-b last:border-0 pb-2">
                  <div className="text-xs text-muted-foreground">{h.subjects?.name ?? "General"} · {formatDate(h.date)}{h.due_date && ` · Due ${formatDate(h.due_date)}`}</div>
                  <div className="text-sm">{h.description}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Results</CardTitle>
              {(resQ.data ?? []).length > 0 && (
                <Button size="sm" variant="outline" onClick={downloadReportCard}>
                  <Download className="h-4 w-4 mr-1" /> PDF
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-3" ref={resultsRef}>
              {(resQ.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">No results declared yet.</div>}
              {(resQ.data ?? []).map((ex: any) => (
                <div key={ex.id} className="border rounded-md p-3">
                  <div className="font-medium text-sm mb-2">{ex.name} <Badge variant="secondary" className="ml-1">{ex.starts_on ? formatDate(ex.starts_on) : ""}</Badge></div>
                  <div className="space-y-1">
                    {ex.marks.map((m: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span>{m.subject}</span>
                        <span className="font-medium">{m.obtained ?? "—"}{m.max ? ` / ${m.max}` : ""} {m.grade && <span className="text-muted-foreground ml-1">({m.grade})</span>}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle>Attendance</CardTitle>
              <div className="text-xs text-muted-foreground mt-1">
                {monthLabel}
                {pct !== null && <span className="ml-2">· {pct}% present</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground mb-1">
              {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="aspect-square" />;
                const status = byDate.get(iso(d));
                const bg =
                  status === "present" ? "bg-green-500 text-white" :
                  status === "absent" ? "bg-red-500 text-white" :
                  status === "late" ? "bg-yellow-500 text-white" :
                  status === "holiday" ? "bg-gray-400 text-white" :
                  "bg-muted text-muted-foreground";
                return (
                  <div
                    key={i}
                    title={status ? `${iso(d)} · ${status}` : iso(d)}
                    className={`aspect-square rounded flex items-center justify-center text-xs font-medium ${bg}`}
                  >
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-500 inline-block" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Late</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Holiday</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
