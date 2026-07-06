"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Flame, Loader2, Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setPending(true);

    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // With email confirmation enabled there's no session yet.
        if (!data.session) {
          setNotice("Almost there — check your email to confirm your account, then sign in.");
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col justify-center px-6 py-10">
      {/* brand */}
      <div className="rise mb-10 flex flex-col items-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-accent/10 ring-1 ring-accent/25">
          <Flame className="size-8 text-accent" strokeWidth={2.2} />
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">MacroLog</h1>
        <p className="mt-1 text-sm text-mute">Scan it. Log it. Hit your macros.</p>
      </div>

      {/* mode switch */}
      <div className="rise rise-1 mb-6 grid grid-cols-2 rounded-xl bg-card p-1 ring-1 ring-line">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null); }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-raise text-ink" : "text-mute hover:text-ink-dim"
            }`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="rise rise-2 space-y-3">
        <label className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-line focus-within:ring-accent/60">
          <Mail className="size-4 shrink-0 text-mute" />
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-mute"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-line focus-within:ring-accent/60">
          <Lock className="size-4 shrink-0 text-mute" />
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder="Password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-sm outline-none placeholder:text-mute"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="text-mute hover:text-ink-dim"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </label>

        {error && (
          <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger ring-1 ring-danger/30">
            {error}
          </p>
        )}
        {notice && (
          <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm text-accent ring-1 ring-accent/30">
            {notice}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-bg transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="rise rise-3 mt-8 text-center text-xs text-mute">
        Your food diary is private — only you can see it.
      </p>
    </main>
  );
}
