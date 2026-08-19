import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({
    meta: [
      { title: "Classes — School Hub" },
      { name: "description", content: "All classes and sections with their subjects and student counts." },
      { property: "og:title", content: "Classes — School Hub" },
      { property: "og:description", content: "All classes and sections with their subjects and student counts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClassesPage,
});

function ClassesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["classes-overview"],
    queryFn: async () => {
      const [{ data: classes }, { data: subjects }, { data: students }] = await Promise.all([
        supabase.from("classes").select("*").order("name"),
        supabase.from("subjects").select("id, name, class_id"),
        supabase.from("students").select("id, class_id").limit(1000),
      ]);
      return { classes: classes ?? [], subjects: subjects ?? [], students: students ?? [] };
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Classes</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(data?.classes ?? []).map((c) => {
          const subs = (data?.subjects ?? []).filter((s) => s.class_id === c.id);
          const count = (data?.students ?? []).filter((s) => s.class_id === c.id).length;
          return (
            <Card key={c.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">
                  {c.name} {c.section}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {c.academic_year} · {count} students
                </p>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {subs.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No subjects</span>
                ) : (
                  subs.map((s) => (
                    <Badge key={s.id} variant="secondary">
                      {s.name}
                    </Badge>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
        {(data?.classes ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No classes visible for your account.</p>
        )}
      </div>
    </div>
  );
}
