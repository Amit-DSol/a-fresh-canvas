import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMe } from "@/hooks/use-me";
import { analyticsScope, attendanceByClass, chronicAbsentees } from "@/lib/analytics.functions";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: AnalyticsPage,
  head: () => ({
    meta: [
      { title: "Analytics · School Portal" },
      {
        name: "description",
        content: "Attendance analytics by class with chronic absentee tracking and CSV export.",
      },
      { property: "og:title", content: "Analytics · School Portal" },
      {
        property: "og:description",
        content: "Attendance analytics by class with chronic absentee tracking and CSV export.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function downloadCsv(name: string, header: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AnalyticsPage() {
  const { data: me } = useMe();
  const scopeFn = useServerFn(analyticsScope);
  const byClassFn = useServerFn(attendanceByClass);
  const absenteesFn = useServerFn(chronicAbsentees);

  const defaults = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: iso(from), to: iso(to) };
  }, []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [threshold, setThreshold] = useState(75);

  const scopeQ = useQuery({ queryKey: ["analytics-scope"], queryFn: () => scopeFn() });
  const classesQ = useQuery({
    queryKey: ["analytics-attendance", from, to],
    queryFn: () => byClassFn({ data: { from, to } }),
    enabled: !!from && !!to,
  });
  const absQ = useQuery({
    queryKey: ["analytics-absentees", from, to, threshold],
    queryFn: () => absenteesFn({ data: { from, to, threshold } }),
    enabled: !!from && !!to,
  });

  const staff = me?.role === "admin" || me?.role === "coordinator" || me?.role === "teacher";
  const classRows = classesQ.data ?? [];
  const absRows = absQ.data ?? [];

  const overall = useMemo(() => {
    const s = classRows.reduce(
      (acc, r) => ({ present: acc.present + r.present, marked: acc.marked + r.marked }),
      { present: 0, marked: 0 },
    );
    return { ...s, percent: s.marked ? Math.round((s.present / s.marked) * 1000) / 10 : null };
  }, [classRows]);

  if (!staff) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Access denied</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Analytics are available to school staff only.
          </CardContent>
        </Card>
      </div>
    );
  }

  const noScope = scopeQ.data && scopeQ.data.classes.length === 0;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Attendance trends across the classes you can see.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Absentee threshold (%)</Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(Math.min(100, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="flex items-end">
            <Badge variant="secondary">
              Overall: {overall.percent === null ? "—" : `${overall.percent}%`} ({overall.present}/
              {overall.marked})
            </Badge>
          </div>
        </CardContent>
      </Card>

      {noScope && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You are not assigned as a class teacher for any class, so there is no attendance data to
            analyse. Ask an admin or coordinator for class-teacher access.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Attendance % by class</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={!classRows.length}
            onClick={() =>
              downloadCsv(
                `attendance_by_class_${from}_${to}.csv`,
                ["Class", "Present", "Marked", "Percent"],
                classRows.map((r) => [r.class_label, r.present, r.marked, r.percent ?? ""]),
              )
            }
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {classesQ.isPending && <div className="text-sm text-muted-foreground">Loading…</div>}
          {!classesQ.isPending && classRows.length === 0 && (
            <div className="text-sm text-muted-foreground">No attendance recorded in this range.</div>
          )}
          {classRows.map((r) => (
            <div key={r.class_id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{r.class_label}</span>
                <span className="text-muted-foreground text-xs">
                  {r.percent === null ? "No data" : `${r.percent}% · ${r.present}/${r.marked}`}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={
                    r.percent !== null && r.percent < threshold
                      ? "h-full rounded-full bg-destructive"
                      : "h-full rounded-full bg-primary"
                  }
                  style={{ width: `${r.percent ?? 0}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Chronic absentees (&lt; {threshold}%)</CardTitle>
          <Button
            variant="outline"
            size="sm"
            disabled={!absRows.length}
            onClick={() =>
              downloadCsv(
                `chronic_absentees_${from}_${to}.csv`,
                ["Student", "Class", "Roll", "Present", "Marked", "Percent"],
                absRows.map((r) => [
                  r.full_name,
                  r.class_label,
                  r.roll_number ?? "",
                  r.present,
                  r.marked,
                  r.percent,
                ]),
              )
            }
          >
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="w-16">Roll</TableHead>
                  <TableHead className="w-28">Present</TableHead>
                  <TableHead className="w-20">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {absRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      {absQ.isPending ? "Loading…" : "No students below the threshold."}
                    </TableCell>
                  </TableRow>
                ) : (
                  absRows.map((r) => (
                    <TableRow key={r.student_id}>
                      <TableCell className="font-medium">{r.full_name}</TableCell>
                      <TableCell>{r.class_label}</TableCell>
                      <TableCell>{r.roll_number ?? "—"}</TableCell>
                      <TableCell>
                        {r.present}/{r.marked}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive">{r.percent}%</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
