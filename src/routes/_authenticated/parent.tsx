import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { formatDate } from "@/lib/format";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myAttendance } from "@/lib/attendance.functions";
import { myResults } from "@/lib/exams.functions";
import { myClassHomework } from "@/lib/homework.functions";

const listMyChildren = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Legacy parent link
    const { data: legacy } = await context.supabase
      .from("students")
      .select("id, roll_number, profile:profiles!students_profile_id_fkey(id, full_name), classes(name, section)")
      .eq("parent_profile_id", context.userId);
    // Guardian link (mother/father)
    const { data: guard } = await (context.supabase as any)
      .from("student_guardians")
      .select("students(id, roll_number, profile:profiles!students_profile_id_fkey(id, full_name), classes(name, section))")
      .eq("parent_profile_id", context.userId);
    const map = new Map<string, any>();
    (legacy ?? []).forEach((s: any) => map.set(s.id, s));
    (guard ?? []).forEach((g: any) => { if (g.students) map.set(g.students.id, g.students); });
    return Array.from(map.values());
  });

export const Route = createFileRoute("/_authenticated/parent")({ component: ParentPortal });

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function monthAgoISO() { const d = new Date(); d.setDate(d.getDate() - 30); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }

function ParentPortal() {
  const childrenFn = useServerFn(listMyChildren);
  const q = useQuery({ queryKey: ["my-children"], queryFn: () => childrenFn() });

  return (
    <>
      <div className="max-w-5xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Parent Portal</h1>
        {(q.data ?? []).length === 0 && <Card><CardContent className="py-10 text-center text-muted-foreground">No children linked to your account.</CardContent></Card>}
        {(q.data ?? []).map((c: any) => <ChildBlock key={c.id} child={c} />)}
      </div>
    </>
  );
}

function ChildBlock({ child }: { child: any }) {
  const pid = child.profile?.id;
  const attFn = useServerFn(myAttendance);
  const resFn = useServerFn(myResults);
  const hwFn = useServerFn(myClassHomework);
  const attQ = useQuery({ queryKey: ["p-att", pid], queryFn: () => attFn({ data: { from: monthAgoISO(), to: todayISO(), student_profile_id: pid } }), enabled: !!pid });
  const resQ = useQuery({ queryKey: ["p-res", pid], queryFn: () => resFn({ data: { student_profile_id: pid } }), enabled: !!pid });
  const hwQ = useQuery({ queryKey: ["p-hw", pid], queryFn: () => hwFn({ data: { student_profile_id: pid } }), enabled: !!pid });

  const summary = { present: 0, absent: 0, late: 0, holiday: 0 };
  (attQ.data ?? []).forEach((r: any) => ((summary as any)[r.status] += 1));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link
            to="/student"
            search={{ student: child.id }}
            className="group flex items-center gap-1 hover:text-primary transition-colors"
          >
            <span className="underline-offset-4 group-hover:underline">{child.profile?.full_name}</span>
            <span className="text-sm font-normal text-muted-foreground">· {child.classes?.name} {child.classes?.section} · Roll {child.roll_number ?? "—"}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {(["present","absent","late","holiday"] as const).map((k) => (
            <div key={k} className="border rounded-md p-2 text-center"><div className="text-[10px] uppercase text-muted-foreground">{k}</div><div className="text-xl font-bold">{(summary as any)[k]}</div></div>
          ))}
        </div>
        <div>
          <h3 className="font-medium text-sm mb-2">Recent Homework</h3>
          <div className="space-y-1">
            {(hwQ.data ?? []).slice(0, 5).map((h: any) => (
              <div key={h.id} className="text-sm border-b last:border-0 py-1">
                <span className="text-xs text-muted-foreground">{h.subjects?.name ?? "General"} · {formatDate(h.date)}</span>
                <div>{h.description}</div>
              </div>
            ))}
            {(hwQ.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">None.</div>}
          </div>
        </div>
        <div>
          <h3 className="font-medium text-sm mb-2">Results</h3>
          {(resQ.data ?? []).length === 0 && <div className="text-sm text-muted-foreground">Not declared yet.</div>}
          {(resQ.data ?? []).map((ex: any) => (
            <div key={ex.id} className="border rounded-md p-2 mb-2">
              <div className="text-sm font-medium">{ex.name}</div>
              {ex.marks.map((m: any, i: number) => (
                <div key={i} className="flex justify-between text-sm"><span>{m.subject}</span><span>{m.obtained ?? "—"}{m.max ? ` / ${m.max}` : ""}</span></div>
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
