import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, MessageSquare, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { myAttendance } from "@/lib/attendance.functions";
import { myResults } from "@/lib/exams.functions";
import { myClassHomework } from "@/lib/homework.functions";
import { myStudentInfo } from "@/lib/student.functions";
import { useMe } from "@/hooks/use-me";

export const Route = createFileRoute("/_authenticated/student")({ component: StudentPortal });

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((n) => n[0]?.toUpperCase() ?? "").join("") || "?";
}

function StudentPortal() {
  const { data: me } = useMe();
  const infoFn = useServerFn(myStudentInfo);
  const attFn = useServerFn(myAttendance);
  const resFn = useServerFn(myResults);
  const hwFn = useServerFn(myClassHomework);
  const resultsRef = useRef<HTMLDivElement>(null);

  const infoQ = useQuery({ queryKey: ["my-student-info"], queryFn: () => infoFn() });

  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  const attQ = useQuery({
    queryKey: ["my-att", iso(monthStart), iso(monthEnd)],
    queryFn: () => attFn({ data: { from: iso(monthStart), to: iso(monthEnd) } }),
  });
  const resQ = useQuery({ queryKey: ["my-res"], queryFn: () => resFn({ data: {} }) });
  const hwQ = useQuery({ queryKey: ["my-hw"], queryFn: () => hwFn({ data: {} }) });

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
  const info = infoQ.data;
  const displayName = info?.full_name ?? me?.profile?.full_name ?? "Student";
  const classLabel = info?.class_name
    ? `${info.class_name}${info.class_section ? ` – ${info.class_section}` : ""}`
    : null;

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-4">
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
