"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flame,
  Loader2,
  LogOut,
  Mail,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchProfile, updateGoals } from "@/lib/diary";

type MacroKey = "protein" | "carbs" | "fat";
type Pct = Record<MacroKey, number>;

const MACROS: { key: MacroKey; label: string; kcalPerG: number; color: string }[] = [
  { key: "protein", label: "Protein", kcalPerG: 4, color: "var(--color-protein)" },
  { key: "carbs", label: "Carbs", kcalPerG: 4, color: "var(--color-carbs)" },
  { key: "fat", label: "Fat", kcalPerG: 9, color: "var(--color-fat)" },
];

/** Splits are % of daily calories, in protein/carbs/fat order. */
const PRESETS: { name: string; split: Pct }[] = [
  { name: "Balanced", split: { protein: 30, carbs: 40, fat: 30 } },
  { name: "High protein", split: { protein: 40, carbs: 30, fat: 30 } },
  { name: "Low carb", split: { protein: 35, carbs: 20, fat: 45 } },
];

const PCT_MIN = 5;
const PCT_MAX = 70;

function gramsFor(calories: number, pct: Pct) {
  return {
    protein: Math.round((calories * pct.protein) / 100 / 4),
    carbs: Math.round((calories * pct.carbs) / 100 / 4),
    fat: Math.round((calories * pct.fat) / 100 / 9),
  };
}

/** Derive a 100%-summing split from stored gram goals (by energy share). */
function pctFromGrams(protein: number, carbs: number, fat: number): Pct {
  const kP = protein * 4;
  const kC = carbs * 4;
  const kF = fat * 9;
  const total = kP + kC + kF;
  if (total <= 0) return { protein: 30, carbs: 40, fat: 30 };
  const p = Math.round((kP / total) * 100);
  const c = Math.round((kC / total) * 100);
  let f = 100 - p - c;
  let cc = c;
  if (f < 0) {
    cc += f;
    f = 0;
  }
  return { protein: p, carbs: cc, fat: f };
}

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [calories, setCalories] = useState<number | null>(null);
  const [pct, setPct] = useState<Pct>({ protein: 30, carbs: 40, fat: 30 });
  const [saved, setSaved] = useState<{ calories: number } & Record<MacroKey, number> | null>(null);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    fetchProfile().then((p) => {
      setIsAdmin(p?.role === "admin");
      const cal = p?.calorie_goal ?? 2000;
      const g = {
        protein: p?.protein_goal ?? 150,
        carbs: p?.carbs_goal ?? 250,
        fat: p?.fat_goal ?? 65,
      };
      setCalories(cal);
      setPct(pctFromGrams(g.protein, g.carbs, g.fat));
      setSaved({ calories: cal, ...g });
    });
  }, []);

  const grams = useMemo(
    () => (calories !== null ? gramsFor(calories, pct) : null),
    [calories, pct]
  );

  const dirty =
    !!saved &&
    !!grams &&
    calories !== null &&
    (calories !== saved.calories ||
      MACROS.some(({ key }) => grams[key] !== saved[key]));

  /** Move one macro's %; the other two absorb the change proportionally, always summing to 100. */
  function movePct(key: MacroKey, raw: number) {
    setJustSaved(false);
    setPct((prev) => {
      const v = Math.min(PCT_MAX, Math.max(PCT_MIN, Math.round(raw)));
      const others = MACROS.map((m) => m.key).filter((k) => k !== key) as [MacroKey, MacroKey];
      const rem = 100 - v;
      const oldRem = prev[others[0]] + prev[others[1]];
      let a =
        oldRem <= 0
          ? Math.round(rem / 2)
          : Math.round((prev[others[0]] * rem) / oldRem);
      a = Math.min(Math.max(a, PCT_MIN), rem - PCT_MIN);
      return { ...prev, [key]: v, [others[0]]: a, [others[1]]: rem - a };
    });
  }

  function setCal(v: number) {
    setJustSaved(false);
    setCalories(Math.max(800, v));
  }

  async function handleSave() {
    if (calories === null || !grams) return;
    setSaving(true);
    setError(null);
    try {
      await updateGoals({
        calorie_goal: calories,
        protein_goal: grams.protein,
        carbs_goal: grams.carbs,
        fat_goal: grams.fat,
      });
      setSaved({ calories, ...grams });
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="px-4 pb-10 pt-6">
      <header className="rise flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back to diary"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Settings</h1>
      </header>

      {calories === null || !grams ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : (
        <>
          {/* daily goals */}
          <section className="rise rise-1 mt-5 rounded-3xl bg-card p-5 ring-1 ring-line">
            <h2 className="flex items-center gap-2 text-sm font-bold">
              <Flame className="size-4 text-accent" />
              Daily goals
            </h2>

            {/* calorie goal */}
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-raise px-3 py-2.5 ring-1 ring-line">
              <span className="w-20 text-xs font-semibold text-ink-dim">Calories</span>
              <button
                onClick={() => setCal(calories - 50)}
                aria-label="Decrease calories"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-line transition active:scale-90"
              >
                <Minus className="size-4" />
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={calories}
                min={800}
                step={50}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setCal(Number.isFinite(v) ? v : 800);
                }}
                className="w-full bg-transparent text-center text-lg font-bold tabular-nums outline-none"
              />
              <button
                onClick={() => setCal(calories + 50)}
                aria-label="Increase calories"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-line transition active:scale-90"
              >
                <Plus className="size-4" />
              </button>
              <span className="w-9 text-right text-xs text-mute">kcal</span>
            </div>

            {/* live macro split bar */}
            <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full bg-raise">
              {MACROS.map(({ key, color }) => (
                <div
                  key={key}
                  className="h-full transition-all duration-300"
                  style={{ width: `${pct[key]}%`, background: color }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-center text-[11px] tabular-nums text-mute">
              {pct.protein} / {pct.carbs} / {pct.fat} — protein / carbs / fat, % of calories
            </p>

            {/* one slider per macro */}
            <div className="mt-4 space-y-4">
              {MACROS.map(({ key, label, kcalPerG, color }) => (
                <div key={key}>
                  <div className="flex items-baseline justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-dim">
                      <span className="inline-block size-2 rounded-full" style={{ background: color }} />
                      {label}
                    </span>
                    <span className="text-xs tabular-nums text-mute">
                      <span className="font-bold text-ink">{pct[key]}%</span>
                      {" · "}
                      {grams[key]} g
                      {" · "}
                      {Math.round((calories * pct[key]) / 100)} kcal
                    </span>
                  </div>
                  <input
                    type="range"
                    min={PCT_MIN}
                    max={PCT_MAX}
                    value={pct[key]}
                    onChange={(e) => movePct(key, Number(e.target.value))}
                    aria-label={`${label} percent of calories`}
                    className="mt-2 h-1.5 w-full cursor-pointer appearance-auto"
                    style={{ accentColor: color }}
                  />
                  <p className="sr-only">
                    {kcalPerG} kcal per gram
                  </p>
                </div>
              ))}
            </div>

            {/* presets */}
            <div className="mt-5 grid grid-cols-3 gap-2">
              {PRESETS.map(({ name, split }) => {
                const active =
                  split.protein === pct.protein &&
                  split.carbs === pct.carbs &&
                  split.fat === pct.fat;
                return (
                  <button
                    key={name}
                    onClick={() => {
                      setJustSaved(false);
                      setPct(split);
                    }}
                    className={`rounded-xl py-2 text-[11px] font-semibold ring-1 transition-colors ${
                      active
                        ? "bg-accent/10 text-accent ring-accent/40"
                        : "bg-raise text-ink-dim ring-line hover:text-accent hover:ring-accent/40"
                    }`}
                  >
                    {name}
                    <span className="mt-0.5 block font-normal text-mute">
                      {split.protein}/{split.carbs}/{split.fat}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[11px] text-mute">
              Sliders always total 100% — moving one rebalances the other two.
            </p>

            {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}

            <button
              onClick={handleSave}
              disabled={!dirty || saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-bg transition active:scale-[0.98] disabled:opacity-40"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {justSaved && !dirty ? (
                <>
                  <Check className="size-4" /> Saved
                </>
              ) : (
                "Save goals"
              )}
            </button>
          </section>

          {/* admin */}
          {isAdmin && (
            <section className="rise rise-2 mt-4 rounded-3xl bg-card p-5 ring-1 ring-line">
              <h2 className="text-sm font-bold">Admin</h2>
              <Link
                href="/admin"
                className="mt-3 flex items-center gap-3 rounded-2xl bg-raise px-4 py-3 ring-1 ring-line transition hover:ring-accent/40"
              >
                <ShieldCheck className="size-4 shrink-0 text-accent" />
                <span className="flex-1 text-sm font-medium">Review community foods</span>
                <ChevronRight className="size-4 text-mute" />
              </Link>
            </section>
          )}

          {/* account */}
          <section className="rise rise-3 mt-4 rounded-3xl bg-card p-5 ring-1 ring-line">
            <h2 className="text-sm font-bold">Account</h2>
            <div className="mt-3 flex items-center gap-3 rounded-2xl bg-raise px-4 py-3 ring-1 ring-line">
              <Mail className="size-4 shrink-0 text-mute" />
              <span className="truncate text-sm text-ink-dim">{email || "—"}</span>
            </div>
            <button
              onClick={signOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-danger/10 py-3 text-sm font-semibold text-danger ring-1 ring-danger/30 transition-colors hover:bg-danger/15"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </section>
        </>
      )}
    </main>
  );
}
