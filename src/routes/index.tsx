import { createFileRoute } from "@tanstack/react-router";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarCheck, ClipboardList, Calendar, BookOpen, MessageSquare, School } from "lucide-react";
import { bootstrapMe, getMe, getSchoolSettings } from "@/lib/auth.functions";
import { homeRouteFor } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "School Portal" },
      { name: "description", content: "Attendance, marks, timetable, homework and messaging — one portal for the whole school." },
      { property: "og:title", content: "School Portal" },
      { property: "og:description", content: "Attendance, marks, timetable, homework and messaging — one portal for the whole school." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "School Portal" },
      { name: "twitter:description", content: "Attendance, marks, timetable, homework and messaging — one portal for the whole school." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const bootstrapFn = useServerFn(bootstrapMe);
  const meFn = useServerFn(getMe);
  const schoolFn = useServerFn(getSchoolSettings);
  const { data: school } = useQuery({ queryKey: ["school"], queryFn: () => schoolFn() });
  const name = school?.name ?? "Your School";

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled || !data.session) return;
      await bootstrapFn();
      const me = await meFn();
      if (!cancelled) navigate({ to: homeRouteFor(me?.role ?? null), replace: true });
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrapFn, meFn, navigate]);

  const features = [
    { icon: CalendarCheck, title: "Attendance tracking", body: "Daily attendance with parent and student visibility." },
    { icon: ClipboardList, title: "Flexible exams", body: "Create any exam, set max marks per subject, declare results." },
    { icon: Calendar, title: "Class timetable", body: "Weekly schedule for every class, visible to everyone." },
    { icon: BookOpen, title: "Homework & notices", body: "Teachers post, parents and students see it instantly." },
    { icon: MessageSquare, title: "Parent ↔ teacher", body: "Private one-to-one messaging with the class teacher." },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2">
          {school?.logo_url ? (
            <img src={school.logo_url} alt="" className="h-8 w-8 rounded object-cover" />
          ) : (
            <div className="h-8 w-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <School className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold">{name}</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Login</Link>
        </Button>
      </header>

      <main className="flex-1">
        <section className="px-4 md:px-8 py-20 md:py-28 max-w-5xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
            Everything your school needs, in one place.
          </h1>
          <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            Attendance. Marks. Timetable. Homework. All in one portal — for teachers,
            parents, and students.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/auth">Login to the Portal</Link>
            </Button>
          </div>
        </section>

        <section className="px-4 md:px-8 pb-20 max-w-6xl mx-auto">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title}>
                  <CardContent className="pt-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{f.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        {name} · {school?.academic_year ?? "2025-26"} · Powered by EduPortal
      </footer>
    </div>
  );
}
