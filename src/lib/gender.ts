/** The students.gender check constraint accepts exactly 'Male' | 'Female' | 'Other'. */
export type Gender = "Male" | "Female" | "Other";

export function normalizeGender(value?: string | null): Gender | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v === "m" || v === "male" || v === "boy") return "Male";
  if (v === "f" || v === "female" || v === "girl") return "Female";
  if (v === "o" || v === "other" || v === "others") return "Other";
  return null;
}
