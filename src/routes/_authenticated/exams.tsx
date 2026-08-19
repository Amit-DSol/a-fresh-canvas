import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({
    meta: [
      { title: "Exams & Marks — School Hub" },
      { name: "description", content: "Exam schedule, papers and mark entry for every class." },
      { property: "og:title", content: "Exams & Marks — School Hub" },
      { property: "og:description", content: "Exam schedule, papers and mark entry for every class." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExamsPage,
});

function ExamsPage() {
  const qc = useQueryClient();
  const [paperId, setPaperId] = useState<string>("");

  const { data: exams } = useQuery({
    queryKey: ["exams"],
    queryFn: async () => (await supabase.from("exams").select("*").order("created_at")).data ?? [],
  });

  const { data: papers } = useQuery({
    queryKey: ["exam-papers"],
    queryFn: async () =>
      (
        await supabase
          .from("exam_papers")
          .select("id, paper_date, max_marks, exam_id, subjects:subject_id(name), classes:class_id(name, section)")
          .order("paper_date")
      ).data ?? [],
  });

  const paper = (papers ?? []).find((p) => p.id === paperId);

  const { data: marksData } = useQuery({
    queryKey: ["marks", paperId],
    enabled: !!paperId,
    queryFn: async () => {
      const classId = (paper as unknown as { class_id?: string } | undefined)?.class_id;
      const [{ data: students }, { data: marks }] = await Promise.all([
        supabase
          .from("students")
          .select("id, roll_number, profiles:profile_id(full_name)")
          .eq("class_id", classId ?? "")
          .order("roll_number"),
        supabase.from("marks").select("*").eq("exam_paper_id", paperId),
      ]);
      return { students: students ?? [], marks: marks ?? [] };
    },
  });

  const saveMark = async (studentId: string, value: string) => {
    const marks_obtained = value === "" ? null : Number(value);
    const existing = (marksData?.marks ?? []).find((m) => m.student_id === studentId);
    const res = existing
      ? await supabase.from("marks").update({ marks_obtained }).eq("id", existing.id)
      : await supabase.from("marks").insert({ student_id: studentId, exam_paper_id: paperId, marks_obtained });
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["marks", paperId] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Exams & Marks</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {(exams ?? []).map((e) => (
          <Card key={e.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {e.name}{" "}
                <Badge variant={e.results_declared ? "default" : "secondary"}>
                  {e.results_declared ? "Results declared" : "In progress"}
                </Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {e.academic_year} {e.starts_on ? `· ${e.starts_on} → ${e.ends_on ?? ""}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-1">
              {(papers ?? [])
                .filter((p) => p.exam_id === e.id)
                .map((p) => {
                  const sub = p.subjects as { name?: string } | null;
                  const c = p.classes as { name?: string; section?: string } | null;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPaperId(p.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent ${
                        paperId === p.id ? "bg-accent" : ""
                      }`}
                    >
                      <span>
                        {sub?.name ?? "Subject"} · {c ? `${c.name} ${c.section ?? ""}`.trim() : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.paper_date} · {p.max_marks} marks
                      </span>
                    </button>
                  );
                })}
            </CardContent>
          </Card>
        ))}
        {(exams ?? []).length === 0 && <p className="text-sm text-muted-foreground">No exams visible.</p>}
      </div>

      {paperId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mark entry</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(marksData?.students ?? []).length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No students found for this paper's class.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Roll</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="w-32">Marks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(marksData?.students ?? []).map((s) => {
                    const p = s.profiles as { full_name?: string } | null;
                    const m = (marksData?.marks ?? []).find((x) => x.student_id === s.id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell>{s.roll_number ?? "—"}</TableCell>
                        <TableCell className="font-medium">{p?.full_name ?? "—"}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            defaultValue={m?.marks_obtained ?? ""}
                            onBlur={(e) => saveMark(s.id, e.target.value)}
                          />
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
