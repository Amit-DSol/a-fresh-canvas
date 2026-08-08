import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMe } from "@/hooks/use-me";
import { getSchoolSettings, getDashboardStats } from "@/lib/auth.functions";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data: me, isLoading } = useMe();
  const navigate = useNavigate();
  const getFn = useServerFn(getSchoolSettings);
  const { data: school } = useQuery({ queryKey: ["school"], queryFn: () => getFn() });
  const statsFn = useServerFn(getDashboardStats);
  const { data: stats } = useQuery({ queryKey: ["dashboard-stats"], queryFn: () => statsFn() });

  useEffect(() => {
    if (me?.role === "admin" && school && !school.onboarding_complete) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [me, school, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome{me?.profile?.full_name ? `, ${me.profile.full_name}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading…" : `Signed in as ${me?.role ?? "user"}`}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Students", value: stats?.students },
          { label: "Total Teachers", value: stats?.teachers },
          { label: "Attendance Today", value: stats?.attendanceToday },
          { label: "Exams This Month", value: stats?.examsThisMonth },
        ].map((t) => (
          <Card key={t.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground font-medium">{t.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold">{t.value ?? "—"}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}