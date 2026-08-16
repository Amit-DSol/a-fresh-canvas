import { useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  CalendarCheck,
  ClipboardList,
  Calendar,
  BookOpen,
  Megaphone,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  School,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationsMenu } from "@/components/notifications-menu";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSchoolSettings } from "@/lib/auth.functions";
import type { AppRole } from "@/lib/format";

type NavItem = { to: string; label: string; icon: typeof Users; roles: AppRole[] };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "coordinator", "teacher"] },
  { to: "/students", label: "Students", icon: Users, roles: ["admin", "coordinator", "teacher"] },
  { to: "/teachers", label: "Teachers", icon: GraduationCap, roles: ["admin"] },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "coordinator", "teacher"] },
  { to: "/exams", label: "Exams & Marks", icon: ClipboardList, roles: ["admin", "coordinator", "teacher"] },
  { to: "/timetable", label: "Timetable", icon: Calendar, roles: ["admin", "coordinator", "teacher"] },
  { to: "/homework", label: "Homework", icon: BookOpen, roles: ["admin", "coordinator", "teacher"] },
  { to: "/notices", label: "Notices", icon: Megaphone, roles: ["admin", "coordinator", "teacher"] },
  { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["admin", "coordinator", "teacher"] },
  { to: "/messages", label: "Messages", icon: MessageSquare, roles: ["admin", "coordinator", "teacher"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: me } = useMe();
  const role = (me?.role ?? "admin") as AppRole;
  const schoolFn = useServerFn(getSchoolSettings);
  const { data: school } = useQuery({ queryKey: ["school"], queryFn: () => schoolFn() });
  const items = NAV.filter((n) => n.roles.includes(role));
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-60 border-r border-border bg-sidebar transform transition-transform md:translate-x-0 md:static md:flex md:flex-col",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-14 flex items-center gap-2 px-4 border-b border-border">
          {school?.logo_url ? (
            <img src={school.logo_url} alt="" className="h-7 w-7 rounded object-cover" />
          ) : (
            <div className="h-7 w-7 rounded bg-primary text-primary-foreground flex items-center justify-center">
              <School className="h-4 w-4" />
            </div>
          )}
          <span className="font-semibold text-sm truncate">{school?.name ?? "School Portal"}</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-border">
          <Button variant="ghost" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center gap-2 border-b border-border bg-card px-4 sticky top-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <NotificationsMenu />
          <ThemeToggle />
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-border ml-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
              {(me?.profile?.full_name ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="text-xs leading-tight">
              <div className="font-medium">{me?.profile?.full_name ?? "—"}</div>
              <div className="text-muted-foreground capitalize">{me?.role ?? ""}</div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}