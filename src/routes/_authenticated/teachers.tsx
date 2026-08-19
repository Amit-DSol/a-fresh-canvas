import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({
    meta: [
      { title: "Teachers — School Hub" },
      { name: "description", content: "Staff directory with employee ids, coordinators and assigned classes." },
      { property: "og:title", content: "Teachers — School Hub" },
      { property: "og:description", content: "Staff directory with employee ids, coordinators and assigned classes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeachersPage,
});

function TeachersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: async () => {
      const [{ data: teachers }, { data: links }] = await Promise.all([
        supabase.from("teachers").select("id, employee_id, is_coordinator, profiles:profile_id(full_name, email)"),
        supabase.from("teacher_classes").select("teacher_id, is_class_teacher, classes:class_id(name, section)"),
      ]);
      return { teachers: teachers ?? [], links: links ?? [] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Teachers</h1>
      <Card>
        <CardContent className="p-0">
          {(data?.teachers ?? []).length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No teachers visible for your account.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Employee ID</TableHead>
                  <TableHead>Classes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.teachers ?? []).map((t) => {
                  const p = t.profiles as { full_name?: string } | null;
                  const mine = (data?.links ?? []).filter((l) => l.teacher_id === t.id);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {p?.full_name ?? "—"}{" "}
                        {t.is_coordinator && <Badge className="ml-1">Coordinator</Badge>}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{t.employee_id ?? "—"}</TableCell>
                      <TableCell className="space-x-1">
                        {mine.length === 0
                          ? "—"
                          : mine.map((l, i) => {
                              const c = l.classes as { name?: string; section?: string } | null;
                              return (
                                <Badge key={i} variant="secondary">
                                  {c ? `${c.name} ${c.section ?? ""}`.trim() : "?"}
                                  {l.is_class_teacher ? " ★" : ""}
                                </Badge>
                              );
                            })}
                      </TableCell>
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
