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
  PenLine,
  Plus,
  ScanLine,
  Search,
  Star,
  UtensilsCrossed,
} from "lucide-react";
import AddFoodSheet from "@/components/AddFoodSheet";
import BarcodeScanner from "@/components/BarcodeScanner";
import SwipeToDelete from "@/components/SwipeToDelete";
import {
  addFavorite,
  dateKey,
  entryToFoodItem,
  fetchFavorites,
  fetchRecentFoods,
  removeFavorite,
} from "@/lib/diary";
import {
  communityToFoodItem,
  fetchMyFoods,
  removeFromMyFoods,
  searchCommunityFoods,
} from "@/lib/customFoods";
import type {
  CommunityFood,
  FavoriteFood,
  FoodItem,
  FoodLogEntry,
  Meal,
} from "@/types";

type Tab = "search" | "scan";
type ScanPhase = "scanning" | "looking-up" | "not-found";

/** A food ready to open in the serving sheet. */
interface Picked {
  food: FoodItem;
  allowGrams: boolean;
  initialQty?: number;
}

function guessMeal(): Meal {
  const h = new Date().getHours();
  if (h < 10) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snacks";
}

const STATUS_CHIP: Record<CommunityFood["status"], { label: string; cls: string }> = {
  private: { label: "Private", cls: "bg-raise text-mute ring-line" },
  pending: { label: "In review", cls: "bg-fat/10 text-fat ring-fat/30" },
  approved: { label: "Community", cls: "bg-accent/10 text-accent ring-accent/30" },
  rejected: { label: "Rejected", cls: "bg-danger/10 text-danger ring-danger/30" },
};

function SourceBadge({ source }: { source: FoodItem["source"] }) {
  if (source === "usda")
    return (
      <span className="shrink-0 rounded bg-carbs/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-carbs">
        USDA
      </span>
    );
  if (source === "community")
    return (
      <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-accent">
        CUSTOM
      </span>
    );
  if (source === "fatsecret")
    return (
      <span className="shrink-0 rounded bg-protein/15 px-1 py-0.5 text-[9px] font-bold tracking-wide text-protein">
        FS
      </span>
    );
  return null;
}

function FoodRow({ item, onPick }: { item: Picked; onPick: () => void }) {
  const { food } = item;
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
          {food.source === "community" ? (
            <UtensilsCrossed className="size-5 text-mute" />
          ) : (
            <Package className="size-5 text-mute" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          <span className="truncate">{food.name}</span>
          <SourceBadge source={food.source} />
        </p>
        <p className="truncate text-xs text-mute">
          {food.brand ? `${food.brand} · ` : ""}
          {(food.source === "community" || food.gramsSupported === false) && food.perServing
            ? `${Math.round(food.perServing.calories)} kcal / ${food.servingSize}`
            : `${Math.round(food.per100g.calories)} kcal / 100 g`}
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
  const [selected, setSelected] = useState<Picked | null>(null);

  // --- shown while the search box is empty ---
  const [recents, setRecents] = useState<FoodLogEntry[]>([]);
  const [myFoods, setMyFoods] = useState<CommunityFood[]>([]);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  useEffect(() => {
    fetchRecentFoods().then(setRecents).catch(() => {});
    fetchMyFoods(5).then(setMyFoods).catch(() => {}); // table may not exist yet
    fetchFavorites().then(setFavorites).catch(() => {}); // qol.sql may not be run yet
  }, []);

  const favoriteOf = (name: string, brand: string | null) =>
    favorites.find(
      (f) => f.food_name === name && (f.brand ?? "") === (brand ?? "")
    );

  function toggleFavorite(entry: FoodLogEntry) {
    const existing = favoriteOf(entry.food_name, entry.brand);
    if (existing) {
      setFavorites((cur) => cur.filter((f) => f.id !== existing.id));
      removeFavorite(existing.id).catch(() =>
        setFavorites((cur) => [existing, ...cur])
      );
    } else {
      addFavorite(entry)
        .then((f) => setFavorites((cur) => [f, ...cur]))
        .catch(() => {});
    }
  }

  function handleRemoveMyFood(food: CommunityFood) {
    // Optimistic: drop from the list, restore on failure. Approved foods are
    // only hidden from this list — the community keeps them.
    setMyFoods((cur) => cur.filter((f) => f.id !== food.id));
    removeFromMyFoods(food).catch(() =>
      setMyFoods((cur) => [food, ...cur])
    );
  }

  /** A favourite is the same portion snapshot shape as a diary entry. */
  const favToPicked = (f: FavoriteFood): Picked =>
    entryToFoodItem({
      ...f,
      id: f.id,
      user_id: f.user_id,
      logged_on: "",
      meal: "snacks",
      created_at: f.created_at,
    } as FoodLogEntry);

  // --- search state ---
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Picked[]>([]);
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
        Promise.all([
          fetch(`/api/food-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal }).then(
            (res) => {
              if (!res.ok) throw new Error(String(res.status));
              return res.json() as Promise<FoodItem[]>;
            }
          ),
          // your own + approved community foods, ranked first
          searchCommunityFoods(q).catch(() => [] as CommunityFood[]),
        ])
          .then(([api, custom]) => {
            const customPicked = custom.map(communityToFoodItem);
            const apiPicked = api.map((food) => ({
              food,
              allowGrams: food.gramsSupported !== false,
            }));
            setResults([...customPicked, ...apiPicked]);
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

  const createHref = (extra = "") =>
    `/foods/new?date=${date}&meal=${initialMeal}${extra}`;

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
        <h1 className="flex-1 text-lg font-bold tracking-tight">Add food</h1>
        <Link
          href={createHref()}
          aria-label="Create a food"
          className="flex items-center gap-1.5 rounded-xl bg-card px-3 py-2 text-xs font-semibold text-ink-dim ring-1 ring-line transition-colors hover:text-accent hover:ring-accent/40"
        >
          <PenLine className="size-3.5" />
          Create
        </Link>
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
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <PackageSearch className="size-8 text-mute" />
                <p className="text-sm text-ink-dim">No foods found for “{query.trim()}”.</p>
                <p className="text-xs text-mute">Try a simpler term — or create it yourself.</p>
                <Link
                  href={createHref()}
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-bg"
                >
                  <Plus className="size-3.5" />
                  Create “{query.trim().slice(0, 30)}”
                </Link>
              </div>
            )}

            {results.map((item, i) => (
              <FoodRow
                key={`${item.food.barcode}-${i}`}
                item={item}
                onPick={() => setSelected(item)}
              />
            ))}

            {/* idle view: favourites + my foods + recents */}
            {query.trim().length < 2 && (
              <>
                {favorites.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-mute">
                      <Star className="size-3.5" />
                      Favourites
                    </p>
                    {favorites.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center gap-1 rounded-2xl bg-card p-2 ring-1 ring-line transition hover:ring-accent/40"
                      >
                        <button
                          onClick={() => setSelected(favToPicked(f))}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left active:scale-[0.99]"
                        >
                          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
                            <Star className="size-5 text-accent" fill="currentColor" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{f.food_name}</p>
                            <p className="truncate text-xs text-mute">
                              {f.brand ? `${f.brand} · ` : ""}
                              {f.serving_unit === "g"
                                ? `${f.serving_qty} g`
                                : `${f.serving_qty} × ${f.serving_unit}`}
                              {" · "}
                              {Math.round(f.calories)} kcal
                            </p>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setFavorites((cur) => cur.filter((x) => x.id !== f.id));
                            removeFavorite(f.id).catch(() =>
                              setFavorites((cur) => [f, ...cur])
                            );
                          }}
                          aria-label={`Remove ${f.food_name} from favourites`}
                          className="rounded-lg p-2.5 text-accent transition-colors hover:bg-raise"
                        >
                          <Star className="size-4" fill="currentColor" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {myFoods.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-mute">
                      <UtensilsCrossed className="size-3.5" />
                      My foods
                    </p>
                    {myFoods.map((f) => {
                      const chip = STATUS_CHIP[f.status];
                      return (
                        <SwipeToDelete
                          key={f.id}
                          label={f.status === "approved" ? "Remove from my foods" : "Delete"}
                          onDelete={() => handleRemoveMyFood(f)}
                        >
                          <button
                            onClick={() => setSelected(communityToFoodItem(f))}
                            className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left ring-1 ring-line transition hover:ring-accent/40 active:scale-[0.99]"
                          >
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-raise ring-1 ring-line">
                              <UtensilsCrossed className="size-5 text-mute" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{f.name}</p>
                              <p className="truncate text-xs text-mute">
                                {f.brand ? `${f.brand} · ` : ""}
                                {Math.round(f.calories)} kcal / {f.serving_label}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${chip.cls}`}
                            >
                              {chip.label}
                            </span>
                          </button>
                        </SwipeToDelete>
                      );
                    })}
                    <p className="px-1 text-center text-[10px] text-mute">
                      Swipe a food right to remove it from this list
                    </p>
                  </div>
                )}

                {recents.length > 0 && (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1.5 px-1 pt-1 text-xs font-semibold text-mute">
                      <History className="size-3.5" />
                      Recent
                    </p>
                    {recents.map((entry) => {
                      const faved = !!favoriteOf(entry.food_name, entry.brand);
                      return (
                        <div
                          key={entry.id}
                          className="flex items-center gap-1 rounded-2xl bg-card p-2 ring-1 ring-line transition hover:ring-accent/40"
                        >
                          <button
                            onClick={() => setSelected(entryToFoodItem(entry))}
                            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left active:scale-[0.99]"
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
                          </button>
                          <button
                            onClick={() => toggleFavorite(entry)}
                            aria-label={
                              faved
                                ? `Remove ${entry.food_name} from favourites`
                                : `Add ${entry.food_name} to favourites`
                            }
                            className={`rounded-lg p-2.5 transition-colors hover:bg-raise ${
                              faved ? "text-accent" : "text-mute hover:text-accent"
                            }`}
                          >
                            <Star className="size-4" fill={faved ? "currentColor" : "none"} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {favorites.length === 0 && myFoods.length === 0 && recents.length === 0 && !searching && (
                  <p className="py-12 text-center text-sm text-mute">
                    Powered by Open Food Facts + USDA — millions of foods.
                  </p>
                )}
              </>
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
                {lastBarcode} isn&apos;t in Open Food Facts or USDA yet — you can add it
                yourself from the label.
              </p>
              <div className="mt-2 grid w-full grid-cols-2 gap-2">
                <button
                  onClick={() => setScanPhase("scanning")}
                  className="rounded-xl bg-raise py-2.5 text-xs font-semibold text-ink ring-1 ring-line"
                >
                  Scan again
                </button>
                <Link
                  href={createHref(`&barcode=${encodeURIComponent(lastBarcode)}`)}
                  className="flex items-center justify-center gap-1 rounded-xl bg-accent py-2.5 text-xs font-bold text-bg"
                >
                  <Plus className="size-3.5" />
                  Create food
                </Link>
              </div>
              <button
                onClick={() => setTab("search")}
                className="text-xs font-semibold text-mute underline-offset-2 hover:text-ink-dim hover:underline"
              >
                or search instead
              </button>
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
