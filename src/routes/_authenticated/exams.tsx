import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Plus, CheckCircle2, Pencil, X, Grid3x3, Download, AlertTriangle, User, Upload } from "lucide-react";
import { ImportMarksDialog } from "@/components/import-marks-dialog";

import { useMe } from "@/hooks/use-me";
import { formatDate } from "@/lib/format";
import { listClasses, listSubjects } from "@/lib/settings.functions";
import {
  createExam,
  declareResults,
  deleteExam,
  deleteExamPaper,
  listExamClassesForEntry,
  listExams,
  listMarksForEntry,
  listPendingResults,
  listStudentMarks,
  listStudentResultSheet,
  saveMarks,
  saveSchedule,
  saveStudentMarks,
  upsertExamPaper,
} from "@/lib/exams.functions";

export const Route = createFileRoute("/_authenticated/exams")({ component: ExamsPage });

function ExamsPage() {
  const { data: me } = useMe();
  const canManage = me?.role === "admin" || me?.role === "coordinator" || me?.role === "teacher";
  const listFn = useServerFn(listExams);
  const [selected, setSelected] = useState<string>("");
  const [autoGrid, setAutoGrid] = useState<string>("");
  const [studentEntry, setStudentEntry] = useState<{ exam: any; class_id?: string } | null>(null);
  const examsQ = useQuery({ queryKey: ["exams"], queryFn: () => listFn({ data: {} }) });
  const pendingFn = useServerFn(listPendingResults);
  const pendingQ = useQuery({ queryKey: ["exams-pending"], queryFn: () => pendingFn() });
  const pending: any[] = (pendingQ.data as any[]) ?? [];
  const pendingIds = new Set(pending.map((p: any) => p.exam_id));
  const canCreate = me?.role === "admin" || me?.role === "coordinator";

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Exams</h1>
          <p className="text-muted-foreground text-sm">Exam terms with per-subject schedules and marks.</p>
        </div>
        {canCreate && (
          <CreateExamDialog
            onCreated={async (id?: string) => {
              await examsQ.refetch();
              if (id) { setSelected(id); setAutoGrid(id); }
            }}
          />
        )}
      </div>

      {pending.length > 0 && (
        <Card className="border-amber-500/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Pending results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending.map((t: any) => (
              <div key={t.exam_id} className="space-y-1.5">
                <button
                  onClick={() => setSelected(t.exam_id)}
                  className="text-sm font-medium hover:underline"
                >
                  {t.exam_name}
                </button>
                <span className="text-xs text-muted-foreground"> · ended {formatDate(t.last_date)}</span>
                <div className="space-y-1">
                  {t.classes.map((c: any) => {
                    const done = c.total > 0 && c.entered === c.total;
                    return (
                      <button
                        key={c.class_id}
                        onClick={() => {
                          const ex = (examsQ.data ?? []).find((e: any) => e.id === t.exam_id);
                          setSelected(t.exam_id);
                          setStudentEntry({ exam: ex ?? { id: t.exam_id, name: t.exam_name }, class_id: c.class_id });
                        }}
                        className="flex items-center gap-2 text-sm flex-wrap w-full text-left rounded px-1 py-0.5 hover:bg-accent"
                      >
                        <span className="w-20 font-medium">{c.label}</span>
                        <span className="text-muted-foreground text-xs">
                          {c.entered} of {c.total} subject{c.total === 1 ? "" : "s"} entered
                        </span>
                        <Badge variant={done ? "secondary" : "destructive"} className="text-[10px]">
                          {done ? "Complete" : `${c.total ? Math.round((c.entered / c.total) * 100) : 0}%`}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Exam terms</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {examsQ.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {(examsQ.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">No exams yet.</div>}
            {(examsQ.data ?? []).map((ex: any) => (
              <button
                key={ex.id}
                onClick={() => setSelected(ex.id)}
                className={`w-full text-left p-3 rounded-md border transition-colors ${selected === ex.id ? "bg-accent border-primary" : "hover:bg-accent"}`}
              >
                <div className="font-medium text-sm">{ex.name}</div>
                <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  {(ex.classes_list ?? []).length} class{(ex.classes_list ?? []).length === 1 ? "" : "es"} · {formatDate(ex.starts_on)} – {formatDate(ex.ends_on)}
                  {ex.results_declared && <Badge variant="secondary" className="text-[10px]">Declared</Badge>}
                  {pendingIds.has(ex.id) && <Badge variant="destructive" className="text-[10px]">Pending results</Badge>}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {selected ? (
            <ExamDetail
              exam={(examsQ.data ?? []).find((e: any) => e.id === selected)}
              canManage={!!canManage}
              autoGrid={autoGrid === selected}
              onAutoGridConsumed={() => setAutoGrid("")}
              onStudentEntry={(ex: any) => setStudentEntry({ exam: ex })}
              onChanged={() => examsQ.refetch()}
              onDeleted={() => { setSelected(""); examsQ.refetch(); }}
            />

          ) : (
            <Card><CardContent className="py-16 text-center text-muted-foreground">Select an exam term</CardContent></Card>
          )}
        </div>
      </div>

      {studentEntry && (
        <StudentResultsDialog
          exam={studentEntry.exam}
          initialClassId={studentEntry.class_id}
          onOpenChange={(v: boolean) => { if (!v) setStudentEntry(null); }}
        />
      )}
    </div>
  );
}

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CreateExamDialog({ onCreated }: { onCreated: (id?: string) => void }) {
  const classesFn = useServerFn(listClasses);
  const createFn = useServerFn(createExam);
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [days, setDays] = useState<Date[]>([]);
  const dates = Array.from(new Set(days.map(toISO))).sort();
  const m = useMutation({
    mutationFn: () => createFn({ data: { name, class_ids: classIds, dates } }),
    onSuccess: (row: any) => {
      toast.success("Exam term created");
      setOpen(false); setName(""); setClassIds([]); setDays([]);
      onCreated(row?.id);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Exam Term</Button></DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create exam term</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Half-Yearly 2026" /></div>
          <div className="space-y-1">
            <Label>Classes</Label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-2 grid grid-cols-2 gap-1">
              {(classesQ.data ?? []).map((c: any) => {
                const on = classIds.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setClassIds((prev) => on ? prev.filter((x) => x !== c.id) : [...prev, c.id])}
                    className={`text-xs rounded px-2 py-1 border text-left ${on ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"}`}
                  >
                    {c.name} {c.section}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Exam dates</Label>
            <p className="text-xs text-muted-foreground">Click each date you want to add. Click again to remove.</p>
            <div className="border rounded-md flex justify-center">
              <Calendar
                mode="multiple"
                selected={days}
                onSelect={(d) => setDays((d as Date[] | undefined) ?? [])}
                className="p-3 pointer-events-auto"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {dates.length === 0 && <span className="text-xs text-muted-foreground">No dates selected yet.</span>}
              {dates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays((prev) => prev.filter((x) => toISO(x) !== d))}
                  className="inline-flex items-center gap-1 text-xs rounded-full border px-2 py-1 hover:bg-accent"
                >
                  {formatDate(d)}<X className="h-3 w-3" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => m.mutate()} disabled={!name || classIds.length === 0 || dates.length === 0 || m.isPending}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function sortClasses(list: any[]) {
  return [...list].sort((a, b) =>
    (Number(a.name) || 0) - (Number(b.name) || 0) ||
    String(a.name).localeCompare(String(b.name)) ||
    String(a.section).localeCompare(String(b.section)),
  );
}

function ScheduleGrid({ exam, open, onOpenChange, onSaved }: { exam: any; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const subjectsFn = useServerFn(listSubjects);
  const saveFn = useServerFn(saveSchedule);
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => subjectsFn(), enabled: open });
  const dates: string[] = exam?.dates ?? [];
  const classes = sortClasses(exam?.classes_list ?? []);

  const initial: Record<string, string> = {};
  for (const p of exam?.exam_papers ?? []) initial[`${p.class_id}|${p.paper_date}`] = p.subject_id;
  const [cells, setCells] = useState<Record<string, string>>(initial);
  const [lastKey, setLastKey] = useState(`${exam?.id}|${open}`);
  const key = `${exam?.id}|${open}`;
  if (key !== lastKey) { setCells(initial); setLastKey(key); }

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          exam_id: exam.id,
          cells: dates.flatMap((d) =>
            classes.map((c: any) => ({
              class_id: c.id,
              paper_date: d,
              subject_id: cells[`${c.id}|${d}`] || null,
            })),
          ),
        },
      }),
    onSuccess: () => { toast.success("Schedule saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
        <DialogHeader><DialogTitle>Schedule grid — {exam?.name}</DialogTitle></DialogHeader>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-32">Date</TableHead>
                {classes.map((c: any) => (
                  <TableHead key={c.id} className="min-w-40">{c.name} {c.section}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dates.map((d) => (
                <TableRow key={d}>
                  <TableCell className="text-xs font-medium whitespace-nowrap">{formatDate(d)}</TableCell>
                  {classes.map((c: any) => {
                    const subs = (subjectsQ.data ?? []).filter((s: any) => s.class_id === c.id);
                    const val = cells[`${c.id}|${d}`] ?? "none";
                    return (
                      <TableCell key={c.id}>
                        <Select
                          value={val}
                          onValueChange={(v) =>
                            setCells((prev) => ({ ...prev, [`${c.id}|${d}`]: v === "none" ? "" : v }))
                          }
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="–" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">–</SelectItem>
                            {subs.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
              {dates.length === 0 && (
                <TableRow><TableCell colSpan={classes.length + 1} className="text-center text-sm text-muted-foreground">No dates on this term.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function downloadScheduleCsv(exam: any) {
  const dates: string[] = exam?.dates ?? [];
  const classes = sortClasses(exam?.classes_list ?? []);
  const map = new Map<string, string>();
  for (const p of exam?.exam_papers ?? []) map.set(`${p.class_id}|${p.paper_date}`, p.subjects?.name ?? "–");
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["Date", ...classes.map((c: any) => `${c.name} ${c.section}`)].map(esc).join(","),
    ...dates.map((d) =>
      [formatDate(d), ...classes.map((c: any) => map.get(`${c.id}|${d}`) ?? "–")].map(esc).join(","),
    ),
  ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${String(exam?.name ?? "exam").replace(/[^\w-]+/g, "-").toLowerCase()}-schedule.csv`;
  a.click();
  URL.revokeObjectURL(url);
}


function ExamDetail({ exam, canManage, autoGrid, onAutoGridConsumed, onStudentEntry, onChanged, onDeleted }: { exam: any; canManage: boolean; autoGrid?: boolean; onAutoGridConsumed?: () => void; onStudentEntry?: (exam: any) => void; onChanged: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const delExamFn = useServerFn(deleteExam);
  const delPaperFn = useServerFn(deleteExamPaper);
  const declareFn = useServerFn(declareResults);
  const [marksPaper, setMarksPaper] = useState<any | null>(null);
  const [paperDialog, setPaperDialog] = useState<{ open: boolean; edit?: any }>({ open: false });
  const [gridOpen, setGridOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => {
    if (autoGrid) { setGridOpen(true); onAutoGridConsumed?.(); }
  }, [autoGrid]);

  const declare = useMutation({
    mutationFn: (declared: boolean) => declareFn({ data: { exam_id: exam.id, declared } }),
    onSuccess: () => { toast.success("Updated"); qc.invalidateQueries({ queryKey: ["exams"] }); qc.invalidateQueries({ queryKey: ["exams-pending"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => delExamFn({ data: { id: exam.id } }),
    onSuccess: () => { toast.success("Deleted"); onDeleted(); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!exam) return null;
  const papers = [...(exam.exam_papers ?? [])].sort((a: any, b: any) =>
    (a.paper_date || "").localeCompare(b.paper_date || "") ||
    (a.start_time || "").localeCompare(b.start_time || ""),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>{exam.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {(exam.classes_list ?? []).map((c: any) => `${c.name} ${c.section}`).join(", ") || "No classes"} · {formatDate(exam.starts_on)} – {formatDate(exam.ends_on)}
            </p>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button size="sm" variant={exam.results_declared ? "outline" : "default"} onClick={() => declare.mutate(!exam.results_declared)}>
                <CheckCircle2 className="h-4 w-4 mr-1" />{exam.results_declared ? "Undeclare" : "Declare Results"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => confirm("Delete exam term and all its papers?") && del.mutate()}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">Exam schedule</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => downloadScheduleCsv(exam)}>
                <Download className="h-4 w-4 mr-1" />Download CSV
              </Button>
              {canManage && (
                <Button size="sm" variant="outline" onClick={() => onStudentEntry?.(exam)}>
                  <User className="h-4 w-4 mr-1" />Student results
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
                <Upload className="h-4 w-4 mr-1" />Bulk marks (CSV)
              </Button>

              {canManage && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setGridOpen(true)}>
                    <Grid3x3 className="h-4 w-4 mr-1" />Schedule grid
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setPaperDialog({ open: true })}>
                    <Plus className="h-4 w-4 mr-1" />Add subject
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Room</TableHead>
                  <TableHead>Max</TableHead>
                  <TableHead className="w-40"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {papers.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paper_date)}</TableCell>
                    <TableCell className="text-xs">{p.classes ? `${p.classes.name} ${p.classes.section}` : "—"}</TableCell>
                    <TableCell className="font-medium">{p.subjects?.name ?? "—"}</TableCell>

                    <TableCell className="text-xs">{p.start_time?.slice(0, 5) ?? "—"}{p.end_time ? `–${p.end_time.slice(0, 5)}` : ""}</TableCell>
                    <TableCell className="text-xs">{p.room ?? "—"}</TableCell>
                    <TableCell>{p.max_marks}</TableCell>
                    <TableCell className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setMarksPaper(p)}>Marks</Button>
                      {canManage && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setPaperDialog({ open: true, edit: p })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={async () => {
                            if (!confirm("Delete this paper?")) return;
                            await delPaperFn({ data: { id: p.id } });
                            onChanged();
                          }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {papers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                      No subjects scheduled yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {marksPaper && (
        <MarksEntry
          paper={marksPaper}
          declared={!!exam.results_declared}
          onClose={() => setMarksPaper(null)}
        />
      )}


      <PaperDialog
        open={paperDialog.open}
        edit={paperDialog.edit}
        exam={exam}
        onOpenChange={(v: boolean) => setPaperDialog({ open: v })}
        onSaved={() => { setPaperDialog({ open: false }); onChanged(); }}
      />

      <ScheduleGrid
        exam={exam}
        open={gridOpen}
        onOpenChange={setGridOpen}
        onSaved={() => { setGridOpen(false); onChanged(); }}
      />

      <ImportMarksDialog exam={exam} open={bulkOpen} onOpenChange={setBulkOpen} />

    </div>
  );
}

function PaperDialog({ open, edit, exam, onOpenChange, onSaved }: any) {
  const upsertFn = useServerFn(upsertExamPaper);
  const subjectsFn = useServerFn(listSubjects);
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => subjectsFn(), enabled: open });
  const examClasses = exam?.classes_list ?? [];

  const [classId, setClassId] = useState<string>(edit?.class_id ?? (examClasses.length === 1 ? examClasses[0].id : ""));
  const [subjectId, setSubjectId] = useState<string>(edit?.subject_id ?? "");
  const [paperDate, setPaperDate] = useState<string>(edit?.paper_date ?? "");
  const [startTime, setStartTime] = useState<string>(edit?.start_time?.slice(0, 5) ?? "");
  const [endTime, setEndTime] = useState<string>(edit?.end_time?.slice(0, 5) ?? "");
  const [room, setRoom] = useState<string>(edit?.room ?? "");
  const [maxMarks, setMaxMarks] = useState<string>(edit?.max_marks?.toString() ?? "100");

  const available = (subjectsQ.data ?? []).filter((s: any) => s.class_id === classId);

  // Reset when edit target changes
  const key = edit?.id ?? "new";
  const [lastKey, setLastKey] = useState(key);
  if (lastKey !== key) {
    setClassId(edit?.class_id ?? (examClasses.length === 1 ? examClasses[0].id : ""));
    setSubjectId(edit?.subject_id ?? "");
    setPaperDate(edit?.paper_date ?? "");
    setStartTime(edit?.start_time?.slice(0, 5) ?? "");
    setEndTime(edit?.end_time?.slice(0, 5) ?? "");
    setRoom(edit?.room ?? "");
    setMaxMarks(edit?.max_marks?.toString() ?? "100");
    setLastKey(key);
  }

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: edit?.id,
          exam_id: exam.id,
          class_id: classId,
          subject_id: subjectId,
          paper_date: paperDate,
          start_time: startTime || null,
          end_time: endTime || null,
          room: room || null,
          max_marks: Number(maxMarks),
        },
      }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{edit ? "Edit paper" : "Add paper"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {examClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.section}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {available.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1"><Label>Date</Label><Input type="date" value={paperDate} min={exam?.starts_on} max={exam?.ends_on} onChange={(e) => setPaperDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>Max marks</Label><Input type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} /></div>
            <div className="space-y-1"><Label>Start time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
            <div className="space-y-1"><Label>End time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          </div>
          <div className="space-y-1"><Label>Room</Label><Input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="e.g. Hall A" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !classId || !subjectId || !paperDate || !maxMarks}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarksEntry({ paper, declared, onClose }: { paper: any; declared?: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const priv = me?.role === "admin" || me?.role === "coordinator";
  const readOnly = !!declared && !priv;
  const listFn = useServerFn(listMarksForEntry);
  const saveFn = useServerFn(saveMarks);
  const q = useQuery({
    queryKey: ["marks-entry", paper.id],
    queryFn: () => listFn({ data: { exam_paper_id: paper.id } }),
  });
  const [rows, setRows] = useState<Record<string, { marks: string; grade: string }>>({});


  const save = useMutation({
    mutationFn: () => {
      const entries = (q.data ?? []).map((s: any) => {
        const local = rows[s.id];
        const marksStr = local?.marks ?? (s.marks_obtained != null ? String(s.marks_obtained) : "");
        return {
          student_id: s.id,
          marks_obtained: marksStr === "" ? null : Number(marksStr),
          grade: (local?.grade ?? s.grade) || null,
        };
      });
      return saveFn({ data: { exam_paper_id: paper.id, entries } });
    },
    onSuccess: () => { toast.success("Marks saved"); setRows({}); qc.invalidateQueries({ queryKey: ["marks-entry", paper.id] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">
          Marks · {paper.subjects?.name} <span className="text-sm text-muted-foreground">(out of {paper.max_marks})</span>
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {readOnly && (
          <p className="text-xs rounded-md border bg-muted/50 px-3 py-2 text-muted-foreground">
            Results declared — read only
          </p>
        )}
        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead className="w-16">Roll</TableHead><TableHead>Student</TableHead><TableHead className="w-32">Marks</TableHead><TableHead className="w-24">Grade</TableHead><TableHead className="w-44">Last edited</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell>{s.roll_number ?? "—"}</TableCell>
                  <TableCell>{s.full_name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      max={paper.max_marks}
                      disabled={readOnly}
                      defaultValue={s.marks_obtained ?? ""}
                      onChange={(e) => setRows((r) => ({ ...r, [s.id]: { ...(r[s.id] ?? { grade: s.grade ?? "" }), marks: e.target.value } }))}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      disabled={readOnly}
                      defaultValue={s.grade ?? ""}
                      onChange={(e) => setRows((r) => ({ ...r, [s.id]: { ...(r[s.id] ?? { marks: s.marks_obtained != null ? String(s.marks_obtained) : "" }), grade: e.target.value } }))}
                    />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {s.updated_at ? `${s.edited_by ?? "Unknown"}, ${formatDate(s.updated_at)}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {(q.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No students in this class.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={readOnly || save.isPending || !(q.data ?? []).length}>{save.isPending ? "Saving…" : "Save Marks"}</Button>
        </div>

      </CardContent>
    </Card>
  );
}

function StudentResultsDialog({
  exam,
  initialClassId,
  onOpenChange,
}: {
  exam: any;
  initialClassId?: string;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const priv = me?.role === "admin" || me?.role === "coordinator";
  const readOnly = !!exam.results_declared && !priv;
  const classesFn = useServerFn(listExamClassesForEntry);
  const sheetFn = useServerFn(listStudentResultSheet);
  const marksFn = useServerFn(listStudentMarks);
  const saveFn = useServerFn(saveStudentMarks);

  const [classId, setClassId] = useState<string>(initialClassId ?? "");
  const [studentId, setStudentId] = useState<string>("");
  const [rows, setRows] = useState<Record<string, { marks?: string; grade?: string; remarks?: string }>>({});

  const classesQ = useQuery({
    queryKey: ["exam-entry-classes", exam.id],
    queryFn: () => classesFn({ data: { exam_id: exam.id } }),
  });
  const classes: any[] = (classesQ.data as any[]) ?? [];

  useEffect(() => {
    if (!classId && classes.length === 1) setClassId(classes[0].id);
  }, [classes.length]);

  const sheetQ = useQuery({
    queryKey: ["exam-entry-sheet", exam.id, classId],
    queryFn: () => sheetFn({ data: { exam_id: exam.id, class_id: classId } }),
    enabled: !!classId,
  });
  const sheet: any = sheetQ.data ?? { students: [], papers: [] };

  const marksQ = useQuery({
    queryKey: ["exam-entry-marks", exam.id, classId, studentId],
    queryFn: () => marksFn({ data: { exam_id: exam.id, class_id: classId, student_id: studentId } }),
    enabled: !!classId && !!studentId,
  });
  const marksByPaper = new Map<string, any>();
  ((marksQ.data as any[]) ?? []).forEach((m: any) => marksByPaper.set(m.exam_paper_id, m));

  const save = useMutation({
    mutationFn: () => {
      const entries = (sheet.papers ?? []).map((p: any) => {
        const existing = marksByPaper.get(p.paper_id);
        const local = rows[p.paper_id] ?? {};
        const marksStr = local.marks ?? (existing?.marks_obtained != null ? String(existing.marks_obtained) : "");
        return {
          exam_paper_id: p.paper_id,
          student_id: studentId,
          marks_obtained: marksStr === "" ? null : Number(marksStr),
          grade: (local.grade ?? existing?.grade) || null,
          remarks: (local.remarks ?? existing?.remarks) || null,
        };
      });
      return saveFn({ data: { entries } });
    },
    onSuccess: () => {
      toast.success("Results saved");
      setRows({});
      qc.invalidateQueries({ queryKey: ["exam-entry-marks", exam.id, classId, studentId] });
      qc.invalidateQueries({ queryKey: ["exams-pending"] });
      qc.invalidateQueries({ queryKey: ["exams"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (paperId: string, patch: any) =>
    setRows((r) => ({ ...r, [paperId]: { ...(r[paperId] ?? {}), ...patch } }));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Student results — {exam.name}</DialogTitle></DialogHeader>

        {readOnly && (
          <p className="text-xs rounded-md border bg-muted/50 px-3 py-2 text-muted-foreground">
            Results declared — read only
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setStudentId(""); setRows({}); }}>
              <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>
                {classes.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!classesQ.isLoading && classes.length === 0 && (
              <p className="text-xs text-muted-foreground">No classes available to you in this term.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={(v) => { setStudentId(v); setRows({}); }} disabled={!classId}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent>
                {(sheet.students ?? []).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.roll_number ? `${s.roll_number} · ` : ""}{s.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {studentId && (
          <div key={`${studentId}-${marksQ.dataUpdatedAt}`} className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead className="w-14">Max</TableHead>
                  <TableHead className="w-24">Marks</TableHead>
                  <TableHead className="w-20">Grade</TableHead>
                  <TableHead className="w-40">Remarks</TableHead>
                  <TableHead className="w-44">Last edited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sheet.papers ?? []).map((p: any) => {
                  const m = marksByPaper.get(p.paper_id);
                  return (
                    <TableRow key={p.paper_id}>
                      <TableCell className="font-medium">{p.subject}</TableCell>
                      <TableCell>{p.max_marks}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          max={p.max_marks}
                          disabled={readOnly}
                          defaultValue={m?.marks_obtained ?? ""}
                          onChange={(e) => set(p.paper_id, { marks: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input disabled={readOnly} defaultValue={m?.grade ?? ""} onChange={(e) => set(p.paper_id, { grade: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input disabled={readOnly} defaultValue={m?.remarks ?? ""} onChange={(e) => set(p.paper_id, { remarks: e.target.value })} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m?.updated_at ? `${m.edited_by ?? "Unknown"}, ${formatDate(m.updated_at)}` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(sheet.papers ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      No subjects scheduled for this class.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button
            onClick={() => save.mutate()}
            disabled={readOnly || save.isPending || !studentId || !(sheet.papers ?? []).length}
          >
            {save.isPending ? "Saving…" : "Save all subjects"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
