import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  listExamClassesForEntry, getMarksSheetForClass, importMarks,
} from "@/lib/exams.functions";

type Sheet = {
  students: { id: string; roll_number: string | null; full_name: string }[];
  papers: { paper_id: string; subject: string; max_marks: number }[];
  marks: { exam_paper_id: string; student_id: string; marks_obtained: number | null }[];
};

type Cell = { paper_id: string; subject: string; value: string; error?: string };
type PreviewRow = {
  line: number;
  roll: string;
  name: string;
  student_id?: string;
  error?: string;
  cells: Cell[];
};

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function normSubject(h: string) {
  return h.replace(/\(max[^)]*\)/i, "").trim().toLowerCase();
}

export function ImportMarksDialog({
  exam,
  open,
  onOpenChange,
}: {
  exam: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const classesFn = useServerFn(listExamClassesForEntry);
  const sheetFn = useServerFn(getMarksSheetForClass);
  const importFn = useServerFn(importMarks);
  const fileRef = useRef<HTMLInputElement>(null);

  const [classId, setClassId] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [unknownCols, setUnknownCols] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const classesQ = useQuery({
    queryKey: ["exam-entry-classes", exam?.id],
    queryFn: () => classesFn({ data: { exam_id: exam.id } }),
    enabled: open && !!exam?.id,
  });

  const sheetQ = useQuery<Sheet>({
    queryKey: ["marks-sheet", exam?.id, classId],
    queryFn: () => sheetFn({ data: { exam_id: exam.id, class_id: classId } }) as any,
    enabled: open && !!exam?.id && !!classId,
  });

  const sheet = sheetQ.data;

  function reset() {
    setRows(null);
    setUnknownCols([]);
    setFileName("");
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function downloadTemplate() {
    if (!sheet) return;
    const marksMap = new Map(
      sheet.marks.map((m) => [`${m.exam_paper_id}|${m.student_id}`, m.marks_obtained]),
    );
    const header = [
      "Roll No",
      "Student Name",
      ...sheet.papers.map((p) => `${p.subject} (Max ${p.max_marks})`),
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const s of sheet.students) {
      const cells = sheet.papers.map((p) => {
        const v = marksMap.get(`${p.paper_id}|${s.id}`);
        return v === null || v === undefined ? "" : String(v);
      });
      lines.push([s.roll_number ?? "", s.full_name, ...cells].map(csvEscape).join(","));
    }
    const cls = (classesQ.data as any[])?.find((c) => c.id === classId);
    const url = URL.createObjectURL(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `marks-${exam.name}-${cls?.label ?? "class"}.csv`.replace(/[^\w.\-]+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(file: File) {
    if (!sheet) return;
    setSummary(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        const byRoll = new Map(
          sheet.students
            .filter((s) => s.roll_number)
            .map((s) => [String(s.roll_number).trim(), s]),
        );
        const bySubject = new Map(sheet.papers.map((p) => [p.subject.toLowerCase(), p]));

        const cols: { field: string; paper: Sheet["papers"][number] }[] = [];
        const unknown: string[] = [];
        for (const f of fields) {
          const key = f.trim().toLowerCase();
          if (key === "roll no" || key === "student name") continue;
          const paper = bySubject.get(normSubject(f));
          if (paper) cols.push({ field: f, paper });
          else unknown.push(f);
        }

        const parsed: PreviewRow[] = res.data.map((r, i) => {
          const roll = String(r["Roll No"] ?? "").trim();
          const student = byRoll.get(roll);
          const cells: Cell[] = cols.map(({ field, paper }) => {
            const value = String(r[field] ?? "").trim();
            let error: string | undefined;
            if (value !== "") {
              const n = Number(value);
              if (!Number.isFinite(n)) error = "not a number";
              else if (n < 0) error = "negative";
              else if (n > paper.max_marks) error = `> max ${paper.max_marks}`;
            }
            return { paper_id: paper.paper_id, subject: paper.subject, value, error };
          });
          return {
            line: i + 2,
            roll,
            name: String(r["Student Name"] ?? "").trim(),
            student_id: student?.id,
            error: student ? undefined : roll ? `Unknown roll number "${roll}"` : "Missing roll number",
            cells,
          };
        });

        setUnknownCols(unknown);
        setRows(parsed);
      },
      error: (e) => toast.error(e.message),
    });
  }

  const stats = useMemo(() => {
    if (!rows) return null;
    let ready = 0;
    let problems = 0;
    let values = 0;
    for (const r of rows) {
      const cellErr = r.cells.some((c) => c.error);
      if (r.error || cellErr) problems++;
      else ready++;
      if (!r.error) values += r.cells.filter((c) => c.value !== "" && !c.error).length;
    }
    return { ready, problems, values };
  }, [rows]);

  async function commit() {
    if (!rows || !sheet) return;
    const entries = rows
      .filter((r) => r.student_id && !r.error)
      .flatMap((r) =>
        r.cells
          .filter((c) => c.value !== "" && !c.error)
          .map((c) => ({
            exam_paper_id: c.paper_id,
            student_id: r.student_id!,
            marks_obtained: Number(c.value),
            roll: r.roll,
            subject: c.subject,
          })),
      );
    if (!entries.length) return toast.error("Nothing to import — no valid marks found");
    setBusy(true);
    try {
      const res: any = await importFn({ data: { exam_id: exam.id, class_id: classId, entries } });
      const rowSkips = rows
        .filter((r) => r.error || r.cells.some((c) => c.error))
        .map((r) => ({
          roll: r.roll || `line ${r.line}`,
          subject: r.error ? "—" : r.cells.filter((c) => c.error).map((c) => c.subject).join(", "),
          reason: r.error ?? r.cells.filter((c) => c.error).map((c) => `${c.subject}: ${c.error}`).join("; "),
        }));
      setSummary({ ...res, skipped: [...rowSkips, ...(res.skipped ?? [])] });
      setRows(null);
      qc.invalidateQueries({ queryKey: ["exams"] });
      qc.invalidateQueries({ queryKey: ["exams-pending"] });
      qc.invalidateQueries({ queryKey: ["marks-sheet"] });
      qc.invalidateQueries({ queryKey: ["marks"] });
      qc.invalidateQueries({ queryKey: ["student-marks"] });
      toast.success(`Imported ${res.created + res.updated} marks`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  const classes = (classesQ.data as any[]) ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk marks import — {exam?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Class</div>
              <Select value={classId} onValueChange={(v) => { setClassId(v); reset(); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" disabled={!sheet || !sheet.papers.length} onClick={downloadTemplate}>
              <Download className="h-4 w-4 mr-1" />Download marks template
            </Button>
            <Button variant="outline" disabled={!sheet || !sheet.papers.length} onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />Import marks
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            />
          </div>

          {classes.length === 0 && !classesQ.isLoading && (
            <p className="text-sm text-muted-foreground">You have no classes to enter marks for in this term.</p>
          )}
          {classId && sheet && sheet.papers.length === 0 && (
            <p className="text-sm text-muted-foreground">No subjects scheduled for this class in this term.</p>
          )}
          {exam?.results_declared && (
            <p className="text-xs text-amber-600">
              Results are declared for this term — only admins and coordinators can import marks.
            </p>
          )}

          {unknownCols.length > 0 && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="h-3.5 w-3.5 inline mr-1 text-amber-600" />
              Ignored column{unknownCols.length > 1 ? "s" : ""} not matching a scheduled subject: {unknownCols.join(", ")}
            </div>
          )}

          {rows && stats && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">{fileName}</span>
                <Badge variant="secondary">{stats.ready} rows ready</Badge>
                <Badge variant={stats.problems ? "destructive" : "secondary"}>{stats.problems} with problems</Badge>
                <Badge variant="outline">{stats.values} marks to write</Badge>
              </div>
              <div className="border rounded-md overflow-x-auto max-h-[45vh]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Roll</TableHead>
                      <TableHead>Student</TableHead>
                      {(rows[0]?.cells ?? []).map((c) => (
                        <TableHead key={c.paper_id}>{c.subject}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.line} className={r.error ? "bg-destructive/5" : ""}>
                        <TableCell className="text-xs">{r.roll || "—"}</TableCell>
                        <TableCell className="text-xs">{r.name || "—"}</TableCell>
                        {r.cells.map((c) => (
                          <TableCell key={c.paper_id} className={`text-xs ${c.error ? "text-destructive font-medium" : ""}`}>
                            {c.value === "" ? "—" : c.value}
                            {c.error && <span className="block text-[10px]">{c.error}</span>}
                          </TableCell>
                        ))}
                        <TableCell className="text-xs">
                          {r.error ? (
                            <span className="text-destructive">{r.error}</span>
                          ) : r.cells.some((c) => c.error) ? (
                            <span className="text-destructive">Fix flagged cells</span>
                          ) : (
                            <span className="text-muted-foreground">OK</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                Blank cells are left untouched — existing marks are never cleared. Rows with problems are skipped.
              </p>
            </>
          )}

          {summary && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>{summary.created} marks created · {summary.updated} updated</span>
              </div>
              {summary.skipped?.length > 0 && (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Roll</TableHead>
                        <TableHead>Subject</TableHead>
                        <TableHead>Reason skipped</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summary.skipped.map((s: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{s.roll}</TableCell>
                          <TableCell className="text-xs">{s.subject}</TableCell>
                          <TableCell className="text-xs text-destructive">{s.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!summary.skipped?.length && (
                <p className="text-xs text-muted-foreground">No rows skipped.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }}>Close</Button>
          {rows && (
            <Button onClick={commit} disabled={busy || !stats?.values}>
              {busy ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Importing…</> : `Import ${stats?.values ?? 0} marks`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
