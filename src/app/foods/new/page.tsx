"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, UtensilsCrossed, Users } from "lucide-react";
import { createCustomFood } from "@/lib/customFoods";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-dim">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded-xl bg-card px-4 py-3 text-sm outline-none ring-1 ring-line placeholder:text-mute focus:ring-accent/60";

function NewFood() {
  const router = useRouter();
  const params = useSearchParams();
  const backHref = `/add?date=${params.get("date") ?? ""}&meal=${params.get("meal") ?? ""}`;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState(params.get("barcode") ?? "");
  const [servingLabel, setServingLabel] = useState("1 serving");
  const [servingGrams, setServingGrams] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [submitToCommunity, setSubmitToCommunity] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const num = (s: string) => {
    const v = parseFloat(s);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  };

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const grams = parseFloat(servingGrams);
      await createCustomFood({
        name: name.trim(),
        brand: brand.trim() || null,
        barcode: barcode.trim() || null,
        serving_label: servingLabel.trim() || "1 serving",
        serving_grams: Number.isFinite(grams) && grams > 0 ? grams : null,
        calories: num(calories),
        protein: num(protein),
        carbs: num(carbs),
        fat: num(fat),
        submit: submitToCommunity,
      });
      router.push(backHref);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <main className="px-4 pb-10 pt-6">
      <header className="rise flex items-center gap-3">
        <Link
          href={backHref}
          aria-label="Back to add food"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <UtensilsCrossed className="size-4.5 text-accent" />
          Create a food
        </h1>
      </header>

      <form onSubmit={handleSave} className="rise rise-1 mt-5 space-y-4">
        <Field label="Name" required>
          <input
            required
            maxLength={120}
            placeholder="e.g. Bacon & egg sandwich"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Brand">
            <input
              placeholder="e.g. Coop"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Barcode">
            <input
              inputMode="numeric"
              placeholder="optional"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Serving">
            <input
              placeholder="1 sandwich"
              value={servingLabel}
              onChange={(e) => setServingLabel(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Serving weight (g)">
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="1"
              placeholder="enables gram logging"
              value={servingGrams}
              onChange={(e) => setServingGrams(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="rounded-2xl bg-card p-4 ring-1 ring-line">
          <p className="text-xs font-semibold text-ink-dim">
            Nutrition <span className="font-normal text-mute">per serving</span>
          </p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(
              [
                ["kcal", calories, setCalories, null, true],
                ["Protein", protein, setProtein, "var(--color-protein)", false],
                ["Carbs", carbs, setCarbs, "var(--color-carbs)", false],
                ["Fat", fat, setFat, "var(--color-fat)", false],
              ] as const
            ).map(([label, value, set, color, required]) => (
              <label key={label} className="block text-center">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  required={required}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-xl bg-raise px-2 py-3 text-center text-sm font-bold tabular-nums outline-none ring-1 ring-line placeholder:font-normal placeholder:text-mute focus:ring-accent/60"
                />
                <span className="mt-1 flex items-center justify-center gap-1 text-[10px] text-mute">
                  {color && (
                    <span className="size-1.5 rounded-full" style={{ background: color }} />
                  )}
                  {label}
                  {label !== "kcal" && " g"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* community submission toggle */}
        <button
          type="button"
          onClick={() => setSubmitToCommunity((s) => !s)}
          className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left ring-1 transition ${
            submitToCommunity
              ? "bg-accent/10 ring-accent/40"
              : "bg-card ring-line"
          }`}
        >
          <div
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              submitToCommunity ? "bg-accent text-bg" : "bg-raise text-mute ring-1 ring-line"
            }`}
          >
            <Users className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Share with the community</p>
            <p className="text-xs text-mute">
              {submitToCommunity
                ? "Will be sent for review — once approved, everyone can find it."
                : "Off — this food stays private to you (you can still log it right away)."}
            </p>
          </div>
          <span
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              submitToCommunity ? "bg-accent" : "bg-raise ring-1 ring-line"
            }`}
          >
            <span
              className={`absolute top-0.5 size-5 rounded-full bg-ink transition-all ${
                submitToCommunity ? "left-[22px] bg-bg" : "left-0.5"
              }`}
            />
          </span>
        </button>

        {error && <p className="text-center text-xs text-danger">{error}</p>}

        <button
          type="submit"
          disabled={pending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-bg transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {submitToCommunity ? "Save & submit for review" : "Save food"}
        </button>
      </form>
    </main>
  );
}

export default function NewFoodPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      }
    >
      <NewFood />
    </Suspense>
  );
}
