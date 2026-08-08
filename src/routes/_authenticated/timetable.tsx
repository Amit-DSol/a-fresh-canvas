import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { useMe } from "@/hooks/use-me";
import { listClasses, listSubjects } from "@/lib/settings.functions";
import { deletePeriod, listTeachersForPicker, listTimetable, upsertPeriod } from "@/lib/timetable.functions";

export const Route = createFileRoute("/_authenticated/timetable")({ component: TimetablePage });

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];

function TimetablePage() {
  const { data: me } = useMe();
  const canEdit = me?.role === "admin" || me?.role === "coordinator";
  const classesFn = useServerFn(listClasses);
  const ttFn = useServerFn(listTimetable);
  const classesQ = useQuery({ queryKey: ["classes"], queryFn: () => classesFn() });
  const [classId, setClassId] = useState<string>("");
  const ttQ = useQuery({
    queryKey: ["timetable", classId],
    queryFn: () => ttFn({ data: { class_id: classId } }),
    enabled: !!classId,
  });

  const grid: Record<string, any> = {};
  (ttQ.data ?? []).forEach((p: any) => { grid[`${p.day_of_week}:${p.period_number}`] = p; });

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-muted-foreground text-sm">Weekly schedule by class.</p>
        </div>
        <Card>
          <CardHeader><CardTitle>Select class</CardTitle></CardHeader>
          <CardContent>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="max-w-xs"><SelectValue placeholder="Choose class" /></SelectTrigger>
              <SelectContent>
                {(classesQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} {c.section}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {classId && (
          <Card>
            <CardHeader><CardTitle>Weekly Schedule</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <div className="min-w-[720px] grid grid-cols-[80px_repeat(6,1fr)] gap-1 text-sm">
                <div className="font-medium p-2">Period</div>
                {DAYS.map((d) => <div key={d} className="font-medium p-2 text-center">{d}</div>)}
                {PERIODS.map((p) => (
                  <>
                    <div key={`p${p}`} className="p-2 font-medium border-t">P{p}</div>
                    {DAYS.map((_, di) => {
                      const dow = di + 1;
                      const cell = grid[`${dow}:${p}`];
                      return (
                        <PeriodCell
                          key={`${dow}-${p}`}
                          classId={classId}
                          dow={dow}
                          period={p}
                          cell={cell}
                          canEdit={canEdit}
                        />
                      );
                    })}
                  </>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

function PeriodCell({ classId, dow, period, cell, canEdit }: any) {
  const qc = useQueryClient();
  const subjectsFn = useServerFn(listSubjects);
  const teachersFn = useServerFn(listTeachersForPicker);
  const upsertFn = useServerFn(upsertPeriod);
  const deleteFn = useServerFn(deletePeriod);
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState<string>(cell?.subject_id ?? "");
  const [teacherId, setTeacherId] = useState<string>(cell?.teacher_id ?? "");
  const subjectsQ = useQuery({ queryKey: ["subjects"], queryFn: () => subjectsFn(), enabled: open });
  const teachersQ = useQuery({ queryKey: ["teachers-picker"], queryFn: () => teachersFn(), enabled: open });

  const save = useMutation({
    mutationFn: () => upsertFn({ data: { id: cell?.id, class_id: classId, subject_id: subjectId || null, teacher_id: teacherId || null, day_of_week: dow, period_number: period } }),
    onSuccess: () => { toast.success("Saved"); setOpen(false); qc.invalidateQueries({ queryKey: ["timetable", classId] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id: cell.id } }),
    onSuccess: () => { toast.success("Cleared"); setOpen(false); qc.invalidateQueries({ queryKey: ["timetable", classId] }); },
  });

  const content = (
    <div className={`border-t p-2 min-h-[60px] ${canEdit ? "cursor-pointer hover:bg-accent" : ""}`}>
      {cell ? (
        <>
          <div className="font-medium truncate">{cell.subjects?.name ?? "—"}</div>
          <div className="text-xs text-muted-foreground truncate">{cell.teachers?.profile?.full_name ?? ""}</div>
        </>
      ) : (
        <div className="text-xs text-muted-foreground text-center pt-2">{canEdit ? "+ Add" : "—"}</div>
      )}
    </div>
  );

  if (!canEdit) return content;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><div>{content}</div></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Period {period} · {DAYS[dow - 1]}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(subjectsQ.data ?? []).filter((s: any) => s.class_id === classId).map((s: any) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Teacher</Label>
            <Select value={teacherId} onValueChange={setTeacherId}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                {(teachersQ.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {cell && <Button variant="destructive" onClick={() => del.mutate()}><Trash2 className="h-4 w-4" /></Button>}
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
