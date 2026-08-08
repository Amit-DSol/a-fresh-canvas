import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getSchoolInfo from "./tools/get-school-info";
import listNotices from "./tools/list-notices";
import listHomework from "./tools/list-homework";
import listTimetable from "./tools/list-timetable";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "school-portal-mcp",
  title: "School Portal",
  version: "0.1.0",
  instructions:
    "Tools for the School Portal. Use these to look up school info, notices, homework, and timetable entries for the signed-in user. All data access is scoped by the user's role via RLS.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getSchoolInfo, listNotices, listHomework, listTimetable],
});