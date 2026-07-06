// USDA FoodData Central client. Server-side only: the API key must not
// reach the browser, so this module is only imported by API routes.
import type { FoodItem } from "@/types";

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

interface FdcNutrient {
  nutrientNumber?: string | number;
  nutrientName?: string;
  unitName?: string;
  value?: number;
}

interface FdcFood {
  fdcId: number;
  description?: string;
  dataType?: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: FdcNutrient[];
}

/** FDC branded descriptions come in ALL CAPS — normalize those only. */
function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Nutrient value per 100 g by USDA nutrient number. */
function nutrient(f: FdcFood, num: string): number | undefined {
  const v = f.foodNutrients?.find((n) => String(n.nutrientNumber) === num)?.value;
  return typeof v === "number" ? v : undefined;
}

function toFoodItem(f: FdcFood): FoodItem | null {
  const raw = f.description?.trim();
  if (!raw) return null;

  const protein = nutrient(f, "203") ?? 0;
  const fat = nutrient(f, "204") ?? 0;
  const carbs = nutrient(f, "205") ?? 0;

  // kcal is usually nutrient 208; some entries only carry an alternate
  // "Energy" nutrient, and some only macros (→ Atwater 4/4/9 estimate).
  let kcal = nutrient(f, "208");
  if (kcal === undefined) {
    const alt = f.foodNutrients?.find(
      (n) => n.nutrientName?.startsWith("Energy") && n.unitName?.toUpperCase() === "KCAL"
    )?.value;
    if (typeof alt === "number") kcal = alt;
  }
  if (kcal === undefined) {
    if (protein === 0 && fat === 0 && carbs === 0) return null;
    kcal = protein * 4 + carbs * 4 + fat * 9;
  }

  const per100g = {
    calories: round1(kcal),
    protein: round1(protein),
    carbs: round1(carbs),
    fat: round1(fat),
  };

  // Branded entries label a serving in g/ml (unit spellings vary: g/GRM, ml/MLT)
  const unit = f.servingSizeUnit?.trim().toLowerCase();
  const grams =
    (unit === "g" || unit === "grm" || unit === "ml" || unit === "mlt") &&
    typeof f.servingSize === "number" &&
    f.servingSize > 0
      ? f.servingSize
      : undefined;
  const household = f.householdServingFullText?.trim();

  const brand = f.brandName?.trim() || f.brandOwner?.trim() || null;

  return {
    barcode: f.gtinUpc || `usda-${f.fdcId}`,
    name: titleCase(raw),
    source: "usda",
    brand: brand ? titleCase(brand) : null,
    imageUrl: null,
    servingSize: grams
      ? household
        ? `${household} (${grams} g)`
        : `${grams} g`
      : household || null,
    per100g,
    perServing: grams
      ? {
          calories: round1((kcal * grams) / 100),
          protein: round1((protein * grams) / 100),
          carbs: round1((carbs * grams) / 100),
          fat: round1((fat * grams) / 100),
        }
      : null,
  };
}

async function fdcSearch(params: Record<string, string>): Promise<FdcFood[]> {
  const key = process.env.USDA_API_KEY;
  if (!key) return []; // integration is optional — no key, no USDA results

  const search = new URLSearchParams({ api_key: key, ...params });
  const res = await fetch(`${FDC_BASE}/foods/search?${search}`);
  if (!res.ok) throw new Error(`USDA FDC error: ${res.status}`);
  const data: { foods?: FdcFood[] } = await res.json();
  return data.foods ?? [];
}

/** Free-text search across generic (Foundation/SR Legacy) and branded foods. */
export async function searchUsda(query: string): Promise<FoodItem[]> {
  const foods = await fdcSearch({
    query,
    dataType: "Foundation,SR Legacy,Branded",
    pageSize: "15",
  });
  return foods.map(toFoodItem).filter((x): x is FoodItem => x !== null);
}

/** Branded-food lookup by UPC/EAN. FDC stores GTINs zero-padded to 14 digits. */
export async function usdaByBarcode(code: string): Promise<FoodItem | null> {
  const strip = (s: string) => s.replace(/^0+/, "");
  const foods = await fdcSearch({
    query: code.padStart(14, "0"),
    dataType: "Branded",
    pageSize: "5",
  });
  const hit = foods.find((f) => f.gtinUpc && strip(f.gtinUpc) === strip(code));
  return hit ? toFoodItem(hit) : null;
}
