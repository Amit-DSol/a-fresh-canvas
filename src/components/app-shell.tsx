import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  School,
  CalendarCheck,
  ClipboardList,
  BookOpen,
  Megaphone,
  LogOut,
} from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/students", label: "Students", icon: Users },
  { to: "/classes", label: "Classes", icon: School },
  { to: "/teachers", label: "Teachers", icon: GraduationCap },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/exams", label: "Exams & Marks", icon: ClipboardList },
  { to: "/homework", label: "Homework", icon: BookOpen },
  { to: "/notices", label: "Notices", icon: Megaphone },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, role } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
            <School className="h-5 w-5 text-primary" />
            School Hub
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none text-foreground">{fullName}</p>
              <p className="text-xs capitalize text-muted-foreground">{role ?? "…"}</p>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
