import type { FoodItem } from "@/types";

const OFF_BASE = "https://world.openfoodfacts.org";

// OFF's API guidelines require an identifying User-Agent; requests without
// one get an HTML block page. Browsers strip this header and send their own,
// which OFF also accepts — this matters for server-side calls.
const OFF_HEADERS = { "User-Agent": "FitnessApp/0.1 (personal project)" };

// Only ask for the fields we map — keeps responses small and fast.
const FIELDS =
  "code,product_name,brands,image_front_small_url,serving_size,nutriments";

interface OffNutriments {
  "energy-kcal_100g"?: number;
  energy_100g?: number; // kJ fallback when kcal is missing
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  "energy-kcal_serving"?: number;
  proteins_serving?: number;
  carbohydrates_serving?: number;
  fat_serving?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  image_front_small_url?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function toFoodItem(p: OffProduct): FoodItem | null {
  const name = p.product_name?.trim();
  if (!name || !p.code) return null;

  const n = p.nutriments ?? {};

  // Prefer declared kcal; some products only report kJ (1 kcal = 4.184 kJ).
  const kcal100 =
    n["energy-kcal_100g"] ??
    (n.energy_100g !== undefined ? n.energy_100g / 4.184 : undefined);
  if (kcal100 === undefined) return null; // useless without calories

  const hasServing =
    n["energy-kcal_serving"] !== undefined && !!p.serving_size;

  return {
    barcode: p.code,
    name,
    source: "off",
    brand: p.brands?.split(",")[0].trim() || null,
    imageUrl: p.image_front_small_url ?? null,
    servingSize: p.serving_size ?? null,
    per100g: {
      calories: round1(kcal100),
      protein: round1(n.proteins_100g ?? 0),
      carbs: round1(n.carbohydrates_100g ?? 0),
      fat: round1(n.fat_100g ?? 0),
    },
    perServing: hasServing
      ? {
          calories: round1(n["energy-kcal_serving"] ?? 0),
          protein: round1(n.proteins_serving ?? 0),
          carbs: round1(n.carbohydrates_serving ?? 0),
          fat: round1(n.fat_serving ?? 0),
        }
      : null,
  };
}

/**
 * Look up a single product by UPC/EAN barcode.
 * Returns null when the barcode isn't in the Open Food Facts database
 * (the caller should fall back to text search / manual entry).
 */
export async function getProductByBarcode(
  barcode: string
): Promise<FoodItem | null> {
  const res = await fetch(
    `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}?fields=${FIELDS}`,
    { headers: OFF_HEADERS }
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts error: ${res.status}`);

  const data: { status: number; product?: OffProduct } = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return toFoodItem(data.product);
}

// Search-a-licious hits look like OffProduct except brands is an array and
// the kJ fallback lives under a different key.
interface OffSearchHit extends Omit<OffProduct, "brands"> {
  brands?: string[] | string;
  nutriments?: OffNutriments & { "energy-kj_100g"?: number };
}

/**
 * Free-text product search (fallback when scanning fails), via OFF's
 * Search-a-licious engine — far better relevance than the legacy
 * /cgi/search.pl endpoint, which returns zero hits for many multi-word
 * branded queries.
 */
export async function searchProducts(query: string): Promise<FoodItem[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: "20",
    fields: FIELDS,
  });

  const res = await fetch(`https://search.openfoodfacts.org/search?${params}`, {
    headers: OFF_HEADERS,
  });
  if (!res.ok) throw new Error(`Open Food Facts error: ${res.status}`);

  const data: { hits?: OffSearchHit[] } = await res.json();
  return (data.hits ?? [])
    .map((hit) => {
      const n = hit.nutriments ?? {};
      return toFoodItem({
        ...hit,
        brands: Array.isArray(hit.brands) ? hit.brands.join(",") : hit.brands,
        nutriments: { energy_100g: n["energy-kj_100g"], ...n },
      });
    })
    .filter((item): item is FoodItem => item !== null);
}
