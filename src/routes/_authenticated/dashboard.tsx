import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, School, GraduationCap, CalendarCheck, BookOpen, ClipboardList } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — School Hub" },
      { name: "description", content: "Overview of students, classes, teachers and attendance in School Hub." },
      { property: "og:title", content: "Dashboard — School Hub" },
      { property: "og:description", content: "Overview of students, classes, teachers and attendance in School Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const count = async (table: "students" | "classes" | "teachers" | "attendance" | "homework" | "exams") => {
  const { count: c } = await supabase.from(table).select("id", { count: "exact", head: true });
  return c ?? 0;
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => ({
      students: await count("students"),
      classes: await count("classes"),
      teachers: await count("teachers"),
      attendance: await count("attendance"),
      homework: await count("homework"),
      exams: await count("exams"),
    }),
  });

  const { data: school } = useQuery({
    queryKey: ["school-settings"],
    queryFn: async () => (await supabase.from("school_settings").select("*").limit(1).maybeSingle()).data,
  });

  const stats = [
    { label: "Students", value: data?.students, icon: Users },
    { label: "Classes", value: data?.classes, icon: School },
    { label: "Teachers", value: data?.teachers, icon: GraduationCap },
    { label: "Attendance records", value: data?.attendance, icon: CalendarCheck },
    { label: "Homework", value: data?.homework, icon: BookOpen },
    { label: "Exams", value: data?.exams, icon: ClipboardList },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{school?.name ?? "School Hub"}</h1>
        <p className="text-sm text-muted-foreground">
          {school?.academic_year ? `Academic year ${school.academic_year}` : "Overview"}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">
                {isLoading ? "…" : (s.value ?? 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
