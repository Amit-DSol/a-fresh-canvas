import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Status = Database["public"]["Enums"]["attendance_status"];
const STATUSES: Status[] = ["present", "absent", "late", "holiday"];

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — School Hub" },
      { name: "description", content: "Mark and review daily attendance for every class." },
      { property: "og:title", content: "Attendance — School Hub" },
      { property: "og:description", content: "Mark and review daily attendance for every class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id, name, section").order("name")).data ?? [],
  });

  const { data: students } = useQuery({
    queryKey: ["class-students", classId],
    enabled: !!classId,
    queryFn: async () =>
      (
        await supabase
          .from("students")
          .select("id, roll_number, profiles:profile_id(full_name)")
          .eq("class_id", classId)
          .order("roll_number")
      ).data ?? [],
  });

  const { data: records } = useQuery({
    queryKey: ["attendance", classId, date],
    enabled: !!classId,
    queryFn: async () =>
      (await supabase.from("attendance").select("*").eq("class_id", classId).eq("date", date)).data ?? [],
  });

  const statusOf = (studentId: string) =>
    (records ?? []).find((r) => r.student_id === studentId)?.status ?? "present";

  const setStatus = async (studentId: string, status: Status) => {
    setSaving(true);
    const existing = (records ?? []).find((r) => r.student_id === studentId);
    const { data: session } = await supabase.auth.getUser();
    const res = existing
      ? await supabase.from("attendance").update({ status }).eq("id", existing.id)
      : await supabase
          .from("attendance")
          .insert({ student_id: studentId, class_id: classId, date, status, marked_by: session.user?.id ?? null });
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["attendance", classId, date] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Attendance</h1>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} {c.section}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <Button
            variant="outline"
            disabled={!classId || saving}
            onClick={() => qc.invalidateQueries({ queryKey: ["attendance", classId, date] })}
          >
            Refresh
          </Button>
        </CardContent>
      </Card>

      {classId && (
        <Card>
          <CardContent className="p-0">
            {(students ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No students in this class.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(students ?? []).map((s) => {
                    const p = s.profiles as { full_name?: string } | null;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.roll_number ?? "—"}</TableCell>
                        <TableCell className="font-medium">{p?.full_name ?? "—"}</TableCell>
                        <TableCell>
                          <Select value={statusOf(s.id)} onValueChange={(v) => setStatus(s.id, v as Status)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map((st) => (
                                <SelectItem key={st} value={st} className="capitalize">
                                  {st}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
