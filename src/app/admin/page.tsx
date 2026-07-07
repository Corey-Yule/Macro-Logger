"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CircleCheck,
  CircleX,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  UtensilsCrossed,
} from "lucide-react";
import { fetchProfile } from "@/lib/diary";
import { fetchPendingFoods, reviewFood } from "@/lib/customFoods";
import type { CommunityFood } from "@/types";

function ReviewCard({
  food,
  onDone,
}: {
  food: CommunityFood;
  onDone: (id: string) => void;
}) {
  // Everything is editable so mistakes can be corrected before approval
  const [name, setName] = useState(food.name);
  const [brand, setBrand] = useState(food.brand ?? "");
  const [servingLabel, setServingLabel] = useState(food.serving_label);
  const [servingGrams, setServingGrams] = useState(
    food.serving_grams !== null ? String(food.serving_grams) : ""
  );
  const [macros, setMacros] = useState({
    calories: String(food.calories),
    protein: String(food.protein),
    carbs: String(food.carbs),
    fat: String(food.fat),
  });
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };
  const edited = {
    calories: num(macros.calories),
    protein: num(macros.protein),
    carbs: num(macros.carbs),
    fat: num(macros.fat),
  };

  // Reviewer aid: what the macros compute to vs the stated calories
  const macroKcal = Math.round(edited.protein * 4 + edited.carbs * 4 + edited.fat * 9);
  const drift =
    edited.calories > 0 ? Math.abs(macroKcal - edited.calories) / edited.calories : 0;
  const suspicious = drift > 0.15;

  const wasEdited =
    name !== food.name ||
    brand !== (food.brand ?? "") ||
    servingLabel !== food.serving_label ||
    servingGrams !== (food.serving_grams !== null ? String(food.serving_grams) : "") ||
    edited.calories !== food.calories ||
    edited.protein !== food.protein ||
    edited.carbs !== food.carbs ||
    edited.fat !== food.fat;

  async function decide(decision: "approved" | "rejected") {
    setActing(decision);
    setError(null);
    try {
      const grams = parseFloat(servingGrams);
      // Corrections only make sense on the food that gets published
      const updates =
        decision === "approved"
          ? {
              name: name.trim() || food.name,
              brand: brand.trim() || null,
              serving_label: servingLabel.trim() || "1 serving",
              serving_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
              ...edited,
            }
          : undefined;
      await reviewFood(food.id, decision, note, updates);
      onDone(food.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed — try again.");
      setActing(null);
    }
  }

  const fieldClass =
    "w-full rounded-lg bg-raise px-2.5 py-2 text-xs outline-none ring-1 ring-line placeholder:text-mute focus:ring-accent/60";

  return (
    <div className="rounded-3xl bg-card p-4 ring-1 ring-line">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
          <UtensilsCrossed className="size-5 text-mute" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Food name"
            className={`${fieldClass} text-sm font-bold`}
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand"
              aria-label="Brand"
              className={fieldClass}
            />
            <input
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
              placeholder="Serving"
              aria-label="Serving label"
              className={fieldClass}
            />
            <input
              value={servingGrams}
              onChange={(e) => setServingGrams(e.target.value)}
              type="number"
              inputMode="decimal"
              placeholder="grams"
              aria-label="Serving grams"
              className={fieldClass}
            />
          </div>
          <p className="text-[11px] text-mute">
            Submitted {new Date(food.created_at).toLocaleDateString()}
            {food.barcode ? ` · ${food.barcode}` : ""}
            {wasEdited && <span className="text-accent"> · edited</span>}
          </p>
        </div>
      </div>

      {/* nutrition per serving — editable */}
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {(
          [
            ["kcal", "calories", null],
            ["Protein", "protein", "var(--color-protein)"],
            ["Carbs", "carbs", "var(--color-carbs)"],
            ["Fat", "fat", "var(--color-fat)"],
          ] as const
        ).map(([label, key, color]) => (
          <label key={key} className="block">
            <input
              value={macros[key]}
              onChange={(e) => setMacros((m) => ({ ...m, [key]: e.target.value }))}
              type="number"
              inputMode="decimal"
              min="0"
              aria-label={`${label} per serving`}
              className="w-full rounded-xl bg-raise px-1 py-2 text-center text-sm font-bold tabular-nums outline-none ring-1 ring-line focus:ring-accent/60"
            />
            <p className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-mute">
              {color && <span className="size-1.5 rounded-full" style={{ background: color }} />}
              {label}
            </p>
          </label>
        ))}
      </div>

      {/* consistency check */}
      <p
        className={`mt-2 flex items-center gap-1.5 text-[11px] ${
          suspicious ? "text-fat" : "text-mute"
        }`}
      >
        {suspicious && <TriangleAlert className="size-3.5 shrink-0" />}
        Macros compute to {macroKcal} kcal
        {suspicious
          ? ` — differs from the stated ${Math.round(edited.calories)} kcal by more than 15%.`
          : " — consistent with the stated calories."}
      </p>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note to the submitter (shown on rejection)"
        className="mt-3 w-full rounded-xl bg-raise px-3 py-2.5 text-xs outline-none ring-1 ring-line placeholder:text-mute focus:ring-accent/60"
      />

      {error && <p className="mt-2 text-center text-xs text-danger">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => decide("rejected")}
          disabled={acting !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-danger/10 py-2.5 text-xs font-semibold text-danger ring-1 ring-danger/30 transition-colors hover:bg-danger/15 disabled:opacity-50"
        >
          {acting === "rejected" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CircleX className="size-3.5" />
          )}
          Reject
        </button>
        <button
          onClick={() => decide("approved")}
          disabled={acting !== null}
          className="flex items-center justify-center gap-1.5 rounded-xl bg-accent py-2.5 text-xs font-bold text-bg transition active:scale-[0.98] disabled:opacity-50"
        >
          {acting === "approved" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CircleCheck className="size-3.5" />
          )}
          Approve
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<CommunityFood[] | null>(null);

  useEffect(() => {
    fetchProfile().then((p) => {
      const admin = p?.role === "admin";
      setIsAdmin(admin);
      if (admin) {
        fetchPendingFoods()
          .then(setPending)
          .catch(() => setPending([]));
      }
    });
  }, []);

  return (
    <main className="px-4 pb-10 pt-6">
      <header className="rise flex items-center gap-3">
        <Link
          href="/settings"
          aria-label="Back to settings"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex flex-1 items-center gap-2 text-lg font-bold tracking-tight">
          <ShieldCheck className="size-4.5 text-accent" />
          Review queue
        </h1>
        {pending && pending.length > 0 && (
          <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent ring-1 ring-accent/30">
            {pending.length}
          </span>
        )}
      </header>

      {isAdmin === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : !isAdmin ? (
        <div className="rise rise-1 mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center ring-1 ring-line">
          <ShieldCheck className="size-8 text-mute" />
          <p className="text-sm font-semibold">Admin access required</p>
          <p className="text-xs text-mute">
            This page is for reviewing community food submissions.
          </p>
        </div>
      ) : pending === null ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      ) : pending.length === 0 ? (
        <div className="rise rise-1 mt-6 flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center ring-1 ring-line">
          <CircleCheck className="size-8 text-accent" />
          <p className="text-sm font-semibold">All clear</p>
          <p className="text-xs text-mute">No community foods waiting for review.</p>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {pending.map((food, i) => (
            <div key={food.id} className={`rise rise-${Math.min(i + 1, 5)}`}>
              <ReviewCard
                food={food}
                onDone={(id) =>
                  setPending((cur) => (cur ? cur.filter((f) => f.id !== id) : cur))
                }
              />
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
