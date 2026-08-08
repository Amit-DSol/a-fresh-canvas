import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { markPasswordSet } from "@/lib/people.functions";

export const Route = createFileRoute("/set-password")({
  ssr: false,
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const navigate = useNavigate();
  const markFn = useServerFn(markPasswordSet);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase auto-parses the recovery URL hash; PKCE links arrive as ?code=.
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          /* handled by the session check below */
        }
      }
      const { data } = await supabase.auth.getSession();
      setHasSession(!!data.session);
      setChecking(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit() {
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    try {
      await markFn();
    } catch {
      /* non-fatal */
    }
    toast.success("Password set — you're signed in");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mx-auto h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>Set your password</CardTitle>
          <CardDescription>
            Choose a password you'll use to sign in from now on.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {checking ? (
            <p className="text-sm text-muted-foreground">Checking your reset link…</p>
          ) : !hasSession ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">
                This link is invalid or has expired. Request a new password reset link from the sign-in page.
              </p>
              <Button variant="outline" className="w-full" onClick={() => navigate({ to: "/auth", search: { next: undefined } })}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="pw">New password</Label>
                <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw2">Confirm password</Label>
                <Input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <Button className="w-full" onClick={submit} disabled={busy}>
                {busy ? "Saving…" : "Save & continue"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
