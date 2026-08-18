import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "School Hub — School Management" },
      {
        name: "description",
        content:
          "School Hub keeps classes, students, teachers, attendance, exams and results organised in one simple place.",
      },
      { property: "og:title", content: "School Hub — School Management" },
      {
        property: "og:description",
        content:
          "School Hub keeps classes, students, teachers, attendance, exams and results organised in one simple place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <div className="min-h-screen bg-background" />;
}
