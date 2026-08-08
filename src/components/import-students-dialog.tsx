import { useRef, useState } from "react";
import Papa from "papaparse";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { importStudents, type ImportStudentRow } from "@/lib/people.functions";

const HEADERS = [
  "student_name", "student_email", "class", "section", "roll_number", "admission_number",
  "date_of_birth", "gender", "father_name", "father_email", "father_phone",
  "mother_name", "mother_email", "mother_phone",
];

const SAMPLE = [
  "Aarav Sharma,aarav@example.com,10,A,12,ADM1001,2010-04-15,male,Rakesh Sharma,rakesh@example.com,9876543210,Sunita Sharma,sunita@example.com,9876543211",
  "Isha Sharma,isha@example.com,8,B,7,ADM1002,2012-09-02,female,Rakesh Sharma,rakesh@example.com,9876543210,,,",
];

type ParsedRow = {
  row: number;
  raw: Record<string, string>;
  errors: string[];
  payload?: ImportStudentRow;
};

function norm(v: unknown) {
  return String(v ?? "").trim();
}

export function ImportStudentsDialog({
  classes,
  onDone,
}: {
  classes: any[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importFn = useServerFn(importStudents);

  function downloadTemplate() {
    const csv = [HEADERS.join(","), ...SAMPLE].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "students-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function classKey(name: string, section: string) {
    return `${name.trim().toLowerCase()}|${section.trim().toLowerCase()}`;
  }

  function handleFile(file: File) {
    setSummary(null);
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const classMap = new Map<string, string>();
        classes.forEach((c) => classMap.set(classKey(c.name, c.section), c.id));
        const seenEmails = new Map<string, number>();

        const parsed: ParsedRow[] = res.data.map((raw, i) => {
          const rowNo = i + 2; // header is row 1
          const errors: string[] = [];
          const name = norm(raw["student_name"]);
          const email = norm(raw["student_email"]).toLowerCase();
          const cls = norm(raw["class"]);
          const section = norm(raw["section"]);
          const dob = norm(raw["date_of_birth"]);

          if (!name) errors.push("student_name is required");
          if (!email) errors.push("student_email is required");
          else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("student_email is not a valid email");
          if (!cls) errors.push("class is required");
          if (!section) errors.push("section is required");

          let classId: string | undefined;
          if (cls && section) {
            classId = classMap.get(classKey(cls, section));
            if (!classId) errors.push(`class "${cls} – ${section}" not found or not yours to manage`);
          }
          if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push("date_of_birth must be YYYY-MM-DD");

          if (email) {
            const prev = seenEmails.get(email);
            if (prev) errors.push(`duplicate student_email (also on row ${prev})`);
            else seenEmails.set(email, rowNo);
          }

          const payload: ImportStudentRow | undefined =
            errors.length === 0
              ? {
                  row: rowNo,
                  full_name: name,
                  email,
                  class_id: classId!,
                  roll_number: norm(raw["roll_number"]) || undefined,
                  admission_number: norm(raw["admission_number"]) || undefined,
                  date_of_birth: dob || undefined,
                  gender: norm(raw["gender"]).toLowerCase() || undefined,
                  father: norm(raw["father_email"])
                    ? {
                        full_name: norm(raw["father_name"]),
                        email: norm(raw["father_email"]).toLowerCase(),
                        phone: norm(raw["father_phone"]) || undefined,
                      }
                    : undefined,
                  mother: norm(raw["mother_email"])
                    ? {
                        full_name: norm(raw["mother_name"]),
                        email: norm(raw["mother_email"]).toLowerCase(),
                        phone: norm(raw["mother_phone"]) || undefined,
                      }
                    : undefined,
                }
              : undefined;

          return { row: rowNo, raw, errors, payload };
        });

        setRows(parsed);
      },
      error: (err) => toast.error(err.message),
    });
  }

  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;
  const okCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;

  async function runImport() {
    if (!rows) return;
    setBusy(true);
    try {
      const result = await importFn({ data: { rows: rows.map((r) => r.payload!).filter(Boolean) } });
      setSummary(result);
      setRows(null);
      onDone();
      toast.success(`${result.students_created} student(s) imported`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setRows(null);
    setSummary(null);
    setFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4" /> Import from CSV</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Import students from CSV</DialogTitle></DialogHeader>

        {!summary && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border p-3">
              <div className="text-sm">
                <div className="font-medium">Step 1 — get the template</div>
                <p className="text-xs text-muted-foreground">
                  Required: student_name, student_email, class, section. Dates as YYYY-MM-DD.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={downloadTemplate}>
                <Download className="h-4 w-4" /> Download template CSV
              </Button>
            </div>

            <div className="rounded-md border p-3 space-y-2">
              <div className="text-sm font-medium">Step 2 — upload your file</div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
              />
              {fileName && <p className="text-xs text-muted-foreground">{fileName}</p>}
            </div>

            {rows && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">Step 3 — preview</span>
                  <Badge variant="secondary">{okCount} ready</Badge>
                  {errorCount > 0 && <Badge variant="destructive">{errorCount} with problems</Badge>}
                </div>
                <div className="max-h-72 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr className="text-left">
                        <th className="p-2">#</th>
                        <th className="p-2">Student</th>
                        <th className="p-2">Class</th>
                        <th className="p-2">Guardians</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {rows.map((r) => (
                        <tr key={r.row} className={r.errors.length ? "bg-destructive/5" : ""}>
                          <td className="p-2 text-muted-foreground">{r.row}</td>
                          <td className="p-2">
                            <div className="font-medium">{norm(r.raw["student_name"]) || "—"}</div>
                            <div className="text-muted-foreground">{norm(r.raw["student_email"])}</div>
                          </td>
                          <td className="p-2">{norm(r.raw["class"])} – {norm(r.raw["section"])}</td>
                          <td className="p-2 text-muted-foreground">
                            {[norm(r.raw["father_email"]), norm(r.raw["mother_email"])].filter(Boolean).join(", ") || "—"}
                          </td>
                          <td className="p-2">
                            {r.errors.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            ) : (
                              <ul className="text-destructive space-y-0.5">
                                {r.errors.map((e, i) => <li key={i}>{e}</li>)}
                              </ul>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {errorCount > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Fix the highlighted rows in your file and upload it again — nothing has been created yet.
                  </p>
                )}
              </div>
            )}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating accounts and student records… this can take a moment for large files.
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Students created" value={summary.students_created} />
              <Stat label="Guardian accounts created" value={summary.guardians_created} />
              <Stat label="Guardian accounts reused" value={summary.guardians_reused} />
            </div>
            {summary.failures?.length > 0 ? (
              <div className="space-y-2">
                <div className="text-sm font-medium text-destructive">
                  {summary.failures.length} row(s) failed
                </div>
                <div className="max-h-56 overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50"><tr className="text-left"><th className="p-2">#</th><th className="p-2">Student</th><th className="p-2">Reason</th></tr></thead>
                    <tbody className="divide-y">
                      {summary.failures.map((f: any, i: number) => (
                        <tr key={i}>
                          <td className="p-2 text-muted-foreground">{f.row || "—"}</td>
                          <td className="p-2">{f.student_name}</td>
                          <td className="p-2 text-destructive">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Every row imported successfully.</p>
            )}
          </div>
        )}

        <DialogFooter>
          {summary ? (
            <>
              <Button variant="ghost" onClick={reset}>Import another file</Button>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
              <Button onClick={runImport} disabled={busy || !rows || errorCount > 0 || okCount === 0}>
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : `Import ${okCount || ""} student(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-2xl font-semibold">{value ?? 0}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
