"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  Loader2,
  Package,
  PackageSearch,
  ScanLine,
  Search,
} from "lucide-react";
import AddFoodSheet from "@/components/AddFoodSheet";
import BarcodeScanner from "@/components/BarcodeScanner";
import { dateKey, entryToFoodItem, fetchRecentFoods } from "@/lib/diary";
import type { FoodItem, FoodLogEntry, Meal } from "@/types";

type Tab = "search" | "scan";
type ScanPhase = "scanning" | "looking-up" | "not-found";

function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snacks";
}

function FoodRow({ food, onPick }: { food: FoodItem; onPick: () => void }) {
  return (
    <button
      onClick={onPick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-line transition hover:ring-accent/40 active:scale-[0.99]"
    >
      {food.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={food.imageUrl}
          alt=""
          className="size-12 shrink-0 rounded-xl bg-raise object-cover ring-1 ring-line"
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
          <Package className="size-5 text-mute" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{food.name}</span>
          {food.source === "usda" && (
            <span className="shrink-0 rounded bg-carbs/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-carbs">
              USDA
            </span>
          )}
        </p>
        <p className="truncate text-xs text-mute">
          {food.brand ? `${food.brand} · ` : ""}
          {Math.round(food.per100g.calories)} kcal / 100 g
        </p>
      </div>
      <span className="text-xs font-semibold text-accent">Add</span>
    </button>
  );
}

function AddFood() {
  const router = useRouter();
  const params = useSearchParams();

  const date = (() => {
    const d = params.get("date");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : dateKey();
  })();
  const initialMeal = (() => {
    const m = params.get("meal");
    return m === "breakfast" || m === "lunch" || m === "dinner" || m === "snacks"
      ? m
      : guessMeal();
  })();

  const [tab, setTab] = useState<Tab>(params.get("tab") === "scan" ? "scan" : "search");
  const [selected, setSelected] = useState<{
    food: FoodItem;
    allowGrams: boolean;
    initialQty?: number;
  } | null>(null);

  // --- recent foods (shown while the search box is empty) ---
  const [recents, setRecents] = useState<FoodLogEntry[]>([]);
  useEffect(() => {
    fetchRecentFoods().then(setRecents).catch(() => {});
  }, []);

  // --- search state ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(
      () => {
        if (q.length < 2) {
          setResults([]);
          setSearched(false);
          setSearching(false);
          return;
        }
        setSearching(true);
        setSearchError(false);
        fetch(`/api/food-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
          .then((res) => {
            if (!res.ok) throw new Error(String(res.status));
            return res.json() as Promise<FoodItem[]>;
          })
          .then((items) => {
            setResults(items);
            setSearched(true);
          })
          .catch(() => {
            if (!ctrl.signal.aborted) setSearchError(true);
          })
          .finally(() => {
            if (!ctrl.signal.aborted) setSearching(false);
          });
      },
      q.length < 2 ? 0 : 450
    );
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  // --- scan state ---
  const [scanPhase, setScanPhase] = useState<ScanPhase>("scanning");
  const [lastBarcode, setLastBarcode] = useState("");

  async function handleScan(code: string) {
    setLastBarcode(code);
    setScanPhase("looking-up");
    try {
      const res = await fetch(`/api/food-search?barcode=${encodeURIComponent(code)}`);
      if (res.ok) {
        const food = (await res.json()) as FoodItem;
        setSelected({ food, allowGrams: true });
        setScanPhase("scanning"); // scanner remounts fresh after the sheet closes
      } else {
        setScanPhase("not-found");
      }
    } catch {
      setScanPhase("not-found");
    }
  }

  return (
    <main className="px-4 pb-10 pt-6">
      {/* header */}
      <header className="rise flex items-center gap-3">
        <Link
          href={`/?date=${date}`}
          aria-label="Back to diary"
          className="rounded-xl p-2 text-mute transition-colors hover:bg-card hover:text-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-lg font-bold tracking-tight">Add food</h1>
      </header>

      {/* tabs */}
      <div className="rise rise-1 mt-4 grid grid-cols-2 rounded-xl bg-card p-1 ring-1 ring-line">
        {(
          [
            ["search", "Search", Search],
            ["scan", "Scan", ScanLine],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === key ? "bg-raise text-ink" : "text-mute hover:text-ink-dim"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <section className="rise rise-2 mt-4">
          <label className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3.5 ring-1 ring-line focus-within:ring-accent/60">
            <Search className="size-4 shrink-0 text-mute" />
            <input
              autoFocus
              type="search"
              placeholder="Search foods — e.g. greek yogurt"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent text-sm outline-none placeholder:text-mute"
            />
            {searching && <Loader2 className="size-4 shrink-0 animate-spin text-accent" />}
          </label>

          <div className="mt-3 space-y-2">
            {searchError && (
              <p className="rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger ring-1 ring-danger/30">
                Search failed — check your connection and try again.
              </p>
            )}
            {!searchError && searched && results.length === 0 && !searching && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <PackageSearch className="size-8 text-mute" />
                <p className="text-sm text-ink-dim">No foods found for “{query.trim()}”.</p>
                <p className="text-xs text-mute">Try a simpler term or a brand name.</p>
              </div>
            )}
            {!searched && !searching && query.trim().length < 2 && recents.length === 0 && (
              <p className="py-12 text-center text-sm text-mute">
                Powered by Open Food Facts + USDA — millions of foods.
              </p>
            )}
            {results.map((food) => (
              <FoodRow
                key={food.barcode}
                food={food}
                onPick={() => setSelected({ food, allowGrams: true })}
              />
            ))}

            {/* recent foods when not searching */}
            {query.trim().length < 2 && recents.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-mute">
                  <History className="size-3.5" />
                  Recent
                </p>
                {recents.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => setSelected(entryToFoodItem(entry))}
                    className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-line transition hover:ring-accent/40 active:scale-[0.99]"
                  >
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
                      <History className="size-5 text-mute" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entry.food_name}</p>
                      <p className="truncate text-xs text-mute">
                        {entry.brand ? `${entry.brand} · ` : ""}
                        {entry.serving_unit === "g"
                          ? `${entry.serving_qty} g`
                          : `${entry.serving_qty} × ${entry.serving_unit}`}
                        {" · "}
                        {Math.round(entry.calories)} kcal
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-accent">Log again</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {tab === "scan" && (
        <section className="rise rise-2 mt-4">
          {scanPhase === "scanning" && !selected && (
            <BarcodeScanner onScan={handleScan} />
          )}

          {scanPhase === "looking-up" && (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-3 rounded-3xl bg-card ring-1 ring-line">
              <Loader2 className="size-7 animate-spin text-accent" />
              <p className="text-sm text-ink-dim">Looking up {lastBarcode}…</p>
            </div>
          )}

          {scanPhase === "not-found" && (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-card p-8 text-center ring-1 ring-line">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-raise ring-1 ring-line">
                <PackageSearch className="size-6 text-mute" />
              </div>
              <p className="text-sm font-semibold">Barcode not in the databases</p>
              <p className="text-xs text-mute">
                {lastBarcode} isn&apos;t in Open Food Facts or USDA yet.
              </p>
              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                <button
                  onClick={() => setScanPhase("scanning")}
                  className="rounded-xl bg-raise py-2.5 text-xs font-semibold text-ink ring-1 ring-line"
                >
                  Scan again
                </button>
                <button
                  onClick={() => setTab("search")}
                  className="rounded-xl bg-accent py-2.5 text-xs font-bold text-bg"
                >
                  Search instead
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {selected && (
        <AddFoodSheet
          food={selected.food}
          allowGrams={selected.allowGrams}
          initialQty={selected.initialQty}
          date={date}
          initialMeal={initialMeal}
          onClose={() => setSelected(null)}
          onAdded={() => router.push(`/?date=${date}`)}
        />
      )}
    </main>
  );
}

export default function AddPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-6 animate-spin text-mute" />
        </div>
      }
    >
      <AddFood />
    </Suspense>
  );
}
