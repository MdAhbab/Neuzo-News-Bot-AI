import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, Loader2, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { Logo } from "../components/common";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../lib/store";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const HeroScene = lazy(() =>
  import("../components/three/HeroScene").then((m) => ({ default: m.HeroScene })),
);

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHint, setShowHint] = useState(true);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await signIn(email, password);
      else await signUp(email, password);
      navigate("/app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* form side */}
      <div className="relative flex flex-col bg-background px-6 py-8 sm:px-12">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-2xl">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center">
          <div className="mx-auto w-full max-w-sm py-10">
            <p className="kicker mb-4">Subscriber access</p>
            <h1 className="font-display font-black leading-[1] tracking-[-0.02em]" style={{ fontSize: "clamp(2rem,4vw,2.8rem)" }}>
              {mode === "login" ? "Welcome back." : "Join the desk."}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {mode === "login" ? "Sign in to your verified newsroom." : "Start building cross-verified briefs."}
            </p>

            <div className="relative mt-8 grid grid-cols-2 border border-border text-sm">
              <motion.div
                className="absolute inset-y-0 left-0 w-1/2 bg-secondary"
                animate={{ x: mode === "login" ? "0%" : "100%" }}
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  className={`relative z-10 py-2.5 transition-colors ${mode === m ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {m === "login" ? "Sign in" : "Sign up"}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@neuzo.com" className="rounded-sm" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-sm" required />
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    role="alert"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" disabled={loading} className="w-full rounded-sm bg-primary text-primary-foreground hover:opacity-90">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign in" : "Create account"}
              </Button>
            </form>

            {showHint && (
              <div className="mt-6 flex items-start gap-2 border border-border bg-secondary/50 px-3 py-2.5 font-mono text-xs text-muted-foreground">
                <span>
                  Demo: <span className="text-primary">test@neuzo.com</span> / <span className="text-primary">test123</span>
                </span>
                <button onClick={() => setShowHint(false)} className="ml-auto hover:text-foreground" aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* visual side */}
      <div className="relative hidden overflow-hidden border-l border-border bg-background lg:block">
        <ErrorBoundary fallback={<div className="h-full w-full bg-secondary" />}>
          <Suspense fallback={<div className="h-full w-full bg-secondary" />}>
            <HeroScene className="absolute inset-0" />
          </Suspense>
        </ErrorBoundary>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-background via-transparent to-transparent" />
        <div className="absolute bottom-12 left-12 right-12">
          <p className="font-display font-medium leading-[1.1] tracking-[-0.01em] text-balance" style={{ fontSize: "clamp(1.5rem,2.2vw,2rem)" }}>
            &ldquo;Every claim, cross-checked. Every score, earned.&rdquo;
          </p>
          <p className="kicker mt-3">The Verified Press</p>
        </div>
      </div>
    </div>
  );
}
