import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { homeRouteFor, type AppRole } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapMe, isSetupNeeded, lookupLogin, setInitialPassword } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},
  component: AuthPage,
});

const emailPwd = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});
const signupSchema = emailPwd.extend({
  fullName: z.string().min(2, "Enter your full name"),
});

function safeNext(next: string | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

async function redirectAfterAuth(
  navigate: ReturnType<typeof useNavigate>,
  next: string | undefined,
  bootstrapFn: () => Promise<unknown>,
) {
  const target = safeNext(next);
  if (target) {
    window.location.href = target;
    return;
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await bootstrapFn();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id);
  const order: AppRole[] = ["admin", "coordinator", "teacher", "parent", "student"];
  const list = (roles ?? []).map((r) => r.role as AppRole);
  const primary = order.find((r) => list.includes(r)) ?? null;
  navigate({ to: homeRouteFor(primary), replace: true });
}

type Step = "email" | "password" | "create";

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { next } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const bootstrapFn = useServerFn(bootstrapMe);
  const setupFn = useServerFn(isSetupNeeded);
  const lookupFn = useServerFn(lookupLogin);
  const setInitialFn = useServerFn(setInitialPassword);
  const { data: setup } = useQuery({
    queryKey: ["setup-needed"],
    queryFn: () => setupFn(),
    staleTime: 0,
  });
  const setupNeeded = setup?.setupNeeded ?? false;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectAfterAuth(navigate, next, bootstrapFn);
    });
  }, [navigate, next, bootstrapFn]);

  const signupForm = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", password: "", fullName: "" },
  });

  function resetToEmail() {
    setStep("email");
    setPw("");
    setPw2("");
  }

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      const res = await lookupFn({ data: { email: value } });
      if (!res.exists) {
        toast.error("No account found for this email — contact your school admin");
        return;
      }
      setEmail(value);
      setStep(res.passwordSet ? "password" : "create");
    } catch (err: any) {
      toast.error(err?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function onSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    router.invalidate();
    await redirectAfterAuth(navigate, next, bootstrapFn);
  }

  async function onCreatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters");
    if (pw !== pw2) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await setInitialFn({ data: { email, password: pw } });
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) throw new Error(error.message);
      toast.success("Password set — you're signed in");
      router.invalidate();
      await redirectAfterAuth(navigate, next, bootstrapFn);
    } catch (err: any) {
      toast.error(err?.message ?? "Could not set your password");
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword() {
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/set-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset link sent — check your email");
  }

  async function onSignup(values: z.infer<typeof signupSchema>) {
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin + (safeNext(next) ?? "/auth"),
        data: { full_name: values.fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — signing you in…");
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (signInErr) {
      toast.message("Check your email to confirm your account, then sign in.");
      return;
    }
    router.invalidate();
    await redirectAfterAuth(navigate, next, bootstrapFn);
  }

  async function onGoogle() {
    setBusy(true);
    const returnTo =
      window.location.origin +
      "/auth" +
      (safeNext(next) ? `?next=${encodeURIComponent(safeNext(next)!)}` : "");
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: returnTo });
    if (result.error) {
      setBusy(false);
      toast.error(result.error.message);
      return;
    }
    if (result.redirected) return;
    router.invalidate();
    await redirectAfterAuth(navigate, next, bootstrapFn);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <School className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">School Portal</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>{step === "create" ? "Set your password" : "Sign in"}</CardTitle>
            <CardDescription>
              {setupNeeded
                ? "No admin account exists yet. Create the principal account to get started."
                : step === "create"
                  ? "First time signing in — choose the password you'll use from now on."
                  : "Sign in with the account created by your admin."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {setupNeeded ? (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  This one-time setup creates the principal / admin account. It won't appear again after this.
                </p>
                <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Full name *</Label>
                    <Input id="su-name" {...signupForm.register("fullName")} />
                    {signupForm.formState.errors.fullName && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.fullName.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email *</Label>
                    <Input id="su-email" type="email" {...signupForm.register("email")} />
                    {signupForm.formState.errors.email && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pwd">Password *</Label>
                    <Input id="su-pwd" type="password" {...signupForm.register("password")} />
                    {signupForm.formState.errors.password && (
                      <p className="text-xs text-destructive">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : "Create principal account"}
                  </Button>
                </form>
              </div>
            ) : step === "email" ? (
              <div className="space-y-4">
                <form onSubmit={onEmailSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : "Continue"}
                  </Button>
                </form>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or</span></div>
                </div>
                <Button variant="outline" className="w-full" onClick={onGoogle} disabled={busy}>
                  Continue with Google
                </Button>
              </div>
            ) : step === "password" ? (
              <form onSubmit={onSignIn} className="space-y-3">
                <p className="text-sm text-muted-foreground">{email}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Sign in"}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="underline text-muted-foreground" onClick={resetToEmail}>
                    Use a different email
                  </button>
                  <button type="button" className="underline text-muted-foreground" onClick={onForgotPassword} disabled={busy}>
                    Forgot password?
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={onCreatePassword} className="space-y-3">
                <p className="text-sm text-muted-foreground">{email}</p>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw">New password</Label>
                  <Input
                    id="new-pw"
                    type="password"
                    autoComplete="new-password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-pw2">Confirm password</Label>
                  <Input
                    id="new-pw2"
                    type="password"
                    autoComplete="new-password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Please wait…" : "Set password & sign in"}
                </Button>
                <button type="button" className="underline text-xs text-muted-foreground" onClick={resetToEmail}>
                  Use a different email
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
