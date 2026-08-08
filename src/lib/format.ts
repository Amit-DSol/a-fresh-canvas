export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function gradeFor(percent: number): string {
  if (percent >= 90) return "A+";
  if (percent >= 80) return "A";
  if (percent >= 70) return "B+";
  if (percent >= 60) return "B";
  if (percent >= 50) return "C";
  if (percent >= 35) return "D";
  return "F";
}

export type AppRole = "admin" | "coordinator" | "teacher" | "parent" | "student";

export function homeRouteFor(role: AppRole | null | undefined): string {
  if (role === "parent") return "/parent";
  if (role === "student") return "/student";
  return "/dashboard";
}