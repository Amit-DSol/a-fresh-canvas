import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/notices")({
  head: () => ({
    meta: [
      { title: "Notices — School Hub" },
      { name: "description", content: "School-wide announcements for staff, parents and students." },
      { property: "og:title", content: "Notices — School Hub" },
      { property: "og:description", content: "School-wide announcements for staff, parents and students." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NoticesPage,
});

function NoticesPage() {
  const qc = useQueryClient();
  const { role, session } = useAuth();
  const canPost = role === "admin" || role === "coordinator";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: notices } = useQuery({
    queryKey: ["notices"],
    queryFn: async () =>
      (await supabase.from("notices").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });

  const post = async () => {
    if (!title.trim() || !body.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("notices").insert({
      title,
      body,
      target_roles: ["admin", "coordinator", "teacher", "parent", "student"],
      created_by: session?.user.id ?? null,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setTitle("");
    setBody("");
    toast.success("Notice published");
    qc.invalidateQueries({ queryKey: ["notices"] });
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-foreground">Notices</h1>

      {canPost && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">New notice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="t">Title</Label>
              <Input id="t" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b">Message</Label>
              <Textarea id="b" value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button onClick={post} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {(notices ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No notices yet.</p>
        ) : (
          (notices ?? []).map((n) => (
            <Card key={n.id}>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-foreground">{n.title}</h2>
                  {n.is_pinned && <Badge>Pinned</Badge>}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{n.body}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
