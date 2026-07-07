"use client";

import { useMemo, useState } from "react";
import { Loader2, Minus, Package, Plus, X } from "lucide-react";
import { addEntry, updateEntry } from "@/lib/diary";
import { MEALS, type FoodItem, type Meal } from "@/types";

type Basis = "serving" | "g";

const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

interface Props {
  food: FoodItem;
  date: string;
  initialMeal: Meal;
  onClose: () => void;
  onAdded: () => void;
  /** False when per-100g values can't be trusted (rebuilt from a logged serving). */
  allowGrams?: boolean;
  initialQty?: number;
  /** When set, the sheet edits this existing diary entry instead of adding a new one. */
  editEntryId?: string;
}

export default function AddFoodSheet({
  food,
  date,
  initialMeal,
  onClose,
  onAdded,
  allowGrams = true,
  initialQty,
  editEntryId,
}: Props) {
  const hasServing = food.perServing !== null;
  const [basis, setBasis] = useState<Basis>(hasServing ? "serving" : "g");
  // Keep the raw input string so the field can be cleared while typing —
  // snapping empty input back to a minimum makes it untypable on phones.
  const [qtyStr, setQtyStr] = useState(String(initialQty ?? (hasServing ? 1 : 100)));
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(qtyStr);
  const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;

  const step = basis === "serving" ? 0.5 : 10;
  const min = basis === "serving" ? 0.5 : 5;

  function switchBasis(b: Basis) {
    if (b === basis) return;
    setBasis(b);
    setQtyStr(b === "serving" ? "1" : "100");
  }

  const totals = useMemo(() => {
    const src = basis === "serving" && food.perServing ? food.perServing : food.per100g;
    const factor = basis === "serving" ? qty : qty / 100;
    const r = (n: number) => Math.round(n * factor * 10) / 10;
    return {
      calories: r(src.calories),
      protein: r(src.protein),
      carbs: r(src.carbs),
      fat: r(src.fat),
    };
  }, [food, basis, qty]);

  async function handleAdd() {
    setPending(true);
    setError(null);
    try {
      const payload = {
        logged_on: date,
        meal,
        food_name: food.name,
        brand: food.brand,
        barcode: food.barcode || null,
        serving_qty: qty,
        serving_unit: basis === "serving" ? `serving (${food.servingSize})` : "g",
        ...totals,
      };
      if (editEntryId) {
        await updateEntry(editEntryId, payload);
      } else {
        await addEntry(payload);
      }
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setPending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 mx-auto flex max-w-md flex-col justify-end">
      <button
        aria-label="Close"
        onClick={onClose}
        className="fade-in absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="sheet-up relative rounded-t-3xl bg-card p-5 pb-8 ring-1 ring-line">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-raise" />

        {/* food identity */}
        <div className="flex items-start gap-3">
          {food.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={food.imageUrl}
              alt=""
              className="size-14 shrink-0 rounded-xl bg-raise object-cover ring-1 ring-line"
            />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
              <Package className="size-6 text-mute" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold">{food.name}</h2>
            {food.brand && <p className="truncate text-xs text-mute">{food.brand}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-mute hover:bg-raise hover:text-ink"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* amount basis */}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={() => switchBasis("serving")}
            disabled={!hasServing}
            className={`rounded-xl py-2.5 text-xs font-semibold ring-1 transition ${
              basis === "serving"
                ? "bg-accent/10 text-accent ring-accent/40"
                : "bg-raise text-ink-dim ring-line disabled:opacity-40"
            }`}
          >
            {hasServing ? `Serving (${food.servingSize})` : "No serving info"}
          </button>
          <button
            onClick={() => switchBasis("g")}
            disabled={!allowGrams}
            className={`rounded-xl py-2.5 text-xs font-semibold ring-1 transition ${
              basis === "g"
                ? "bg-accent/10 text-accent ring-accent/40"
                : "bg-raise text-ink-dim ring-line disabled:opacity-40"
            }`}
          >
            Grams
          </button>
        </div>

        {/* quantity stepper */}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-raise px-3 py-2.5 ring-1 ring-line">
          <button
            onClick={() =>
              setQtyStr(String(Math.max(min, Math.round((qty - step) * 100) / 100)))
            }
            aria-label="Decrease amount"
            className="flex size-10 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-line transition active:scale-90"
          >
            <Minus className="size-4" />
          </button>
          <div className="text-center">
            <input
              type="number"
              inputMode="decimal"
              value={qtyStr}
              min={0}
              step={step}
              onChange={(e) => setQtyStr(e.target.value)}
              className="w-24 bg-transparent text-center text-2xl font-bold tabular-nums outline-none"
            />
            <p className="text-[11px] text-mute">
              {basis === "serving" ? "servings" : "grams"}
            </p>
          </div>
          <button
            onClick={() => setQtyStr(String(Math.round((qty + step) * 100) / 100))}
            aria-label="Increase amount"
            className="flex size-10 items-center justify-center rounded-xl bg-card text-ink ring-1 ring-line transition active:scale-90"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {/* live nutrition preview */}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-raise px-4 py-3 ring-1 ring-line">
          <p className="text-2xl font-bold tabular-nums">
            {Math.round(totals.calories)}
            <span className="ml-1 text-xs font-medium text-mute">kcal</span>
          </p>
          <div className="flex gap-3 text-xs font-semibold tabular-nums">
            {(
              [
                ["P", totals.protein, "var(--color-protein)"],
                ["C", totals.carbs, "var(--color-carbs)"],
                ["F", totals.fat, "var(--color-fat)"],
              ] as const
            ).map(([k, v, c]) => (
              <span key={k} className="flex items-center gap-1 text-ink-dim">
                <span className="size-2 rounded-full" style={{ background: c }} />
                {k} {Math.round(v)}g
              </span>
            ))}
          </div>
        </div>

        {/* meal picker */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {MEALS.map((m) => (
            <button
              key={m}
              onClick={() => setMeal(m)}
              className={`rounded-xl py-2 text-[11px] font-semibold ring-1 transition ${
                meal === m
                  ? "bg-accent/10 text-accent ring-accent/40"
                  : "bg-raise text-ink-dim ring-line"
              }`}
            >
              {MEAL_LABEL[m]}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-center text-xs text-danger">{error}</p>}

        <button
          onClick={handleAdd}
          disabled={pending || qty <= 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3.5 text-sm font-bold text-bg transition active:scale-[0.98] disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {qty <= 0
            ? "Enter an amount"
            : editEntryId
              ? `Save changes${meal !== initialMeal ? ` — move to ${MEAL_LABEL[meal]}` : ""}`
              : `Add to ${MEAL_LABEL[meal]}`}
        </button>
      </div>
    </div>
  );
}
