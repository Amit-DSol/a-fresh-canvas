import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({
    meta: [
      { title: "Homework — School Hub" },
      { name: "description", content: "Assign and track homework for each class and subject." },
      { property: "og:title", content: "Homework — School Hub" },
      { property: "og:description", content: "Assign and track homework for each class and subject." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeworkPage,
});

function HomeworkPage() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => (await supabase.from("classes").select("id, name, section").order("name")).data ?? [],
  });

  const { data: subjects } = useQuery({
    queryKey: ["subjects", classId],
    enabled: !!classId,
    queryFn: async () => (await supabase.from("subjects").select("id, name").eq("class_id", classId)).data ?? [],
  });

  const { data: items } = useQuery({
    queryKey: ["homework"],
    queryFn: async () =>
      (
        await supabase
          .from("homework")
          .select("id, description, date, due_date, classes:class_id(name, section), subjects:subject_id(name)")
          .order("date", { ascending: false })
          .limit(100)
      ).data ?? [],
  });

  const add = async () => {
    if (!classId || !description.trim()) {
      toast.error("Pick a class and write the homework.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("homework").insert({
      class_id: classId,
      subject_id: subjectId || null,
      description,
      date: new Date().toISOString().slice(0, 10),
      due_date: dueDate || null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDescription("");
    setDueDate("");
    toast.success("Homework added");
    qc.invalidateQueries({ queryKey: ["homework"] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Homework</h1>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assign homework</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Class</Label>
            <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select class" />
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
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={setSubjectId} disabled={!classId}>
              <SelectTrigger>
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                {(subjects ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="due">Due date</Label>
            <Input id="due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={add} disabled={busy}>
              {busy ? "Saving…" : "Add homework"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No homework yet.</p>
        ) : (
          (items ?? []).map((h) => {
            const c = h.classes as { name?: string; section?: string } | null;
            const s = h.subjects as { name?: string } | null;
            return (
              <Card key={h.id}>
                <CardContent className="pt-6">
                  <p className="text-xs text-muted-foreground">
                    {c ? `${c.name} ${c.section ?? ""}`.trim() : ""} {s?.name ? `· ${s.name}` : ""} · {h.date}
                    {h.due_date ? ` · due ${h.due_date}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-foreground">{h.description}</p>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
