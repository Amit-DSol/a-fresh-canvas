import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({
    meta: [
      { title: "Students — School Hub" },
      { name: "description", content: "Browse and search every student, their class and roll number." },
      { property: "og:title", content: "Students — School Hub" },
      { property: "og:description", content: "Browse and search every student, their class and roll number." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentsPage,
});

function StudentsPage() {
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, roll_number, admission_number, gender, profiles:profile_id(full_name, email), classes:class_id(name, section)")
        .order("roll_number")
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter((s) => {
    const name = (s.profiles as { full_name?: string } | null)?.full_name ?? "";
    return name.toLowerCase().includes(q.toLowerCase()) || (s.roll_number ?? "").includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-foreground">Students</h1>
        <Input
          placeholder="Search by name or roll number"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Card>
        <CardContent className="p-0">
          {error ? (
            <p className="p-6 text-sm text-destructive">You don't have access to this list.</p>
          ) : isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No students found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead className="hidden sm:table-cell">Admission no.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => {
                  const p = s.profiles as { full_name?: string } | null;
                  const c = s.classes as { name?: string; section?: string } | null;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{p?.full_name ?? "—"}</TableCell>
                      <TableCell>{c ? `${c.name} ${c.section ?? ""}`.trim() : "—"}</TableCell>
                      <TableCell>{s.roll_number ?? "—"}</TableCell>
                      <TableCell className="hidden sm:table-cell">{s.admission_number ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
