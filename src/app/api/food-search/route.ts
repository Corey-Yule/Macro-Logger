import { NextResponse, type NextRequest } from "next/server";
import { getProductByBarcode, searchProducts } from "@/lib/openfoodfacts";
import { searchUsda, usdaByBarcode } from "@/lib/usda";
import type { FoodItem } from "@/types";

const strip0 = (s: string) => s.replace(/^0+/, "");

/**
 * GET /api/food-search?q=<text>      → FoodItem[] merged from OFF + USDA
 * GET /api/food-search?barcode=<upc> → FoodItem (OFF first, USDA fallback) or 404
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const barcode = sp.get("barcode")?.trim();
  const q = sp.get("q")?.trim();

  if (barcode) {
    const off = await getProductByBarcode(barcode).catch(() => null);
    const item = off ?? (await usdaByBarcode(barcode).catch(() => null));
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(item);
  }

  if (!q || q.length < 2) return NextResponse.json([]);

  const [off, usda] = await Promise.all([
    searchProducts(q).catch(() => [] as FoodItem[]),
    searchUsda(q).catch(() => [] as FoodItem[]),
  ]);

  // Generic USDA foods (no brand) lead — they're the canonical answer for
  // plain queries like "banana" — then OFF products (they have photos),
  // then USDA branded items that OFF didn't already cover.
  const generic = usda.filter((u) => !u.brand);
  const branded = usda.filter((u) => u.brand);

  const out: FoodItem[] = [];
  const seen = new Set<string>();
  const push = (item: FoodItem) => {
    const codeKey = item.barcode.startsWith("usda-") ? "" : strip0(item.barcode);
    const nameKey = `${item.name}|${item.brand ?? ""}`.toLowerCase();
    if (codeKey && seen.has(`c:${codeKey}`)) return;
    if (seen.has(`n:${nameKey}`)) return;
    if (codeKey) seen.add(`c:${codeKey}`);
    seen.add(`n:${nameKey}`);
    out.push(item);
  };

  generic.slice(0, 5).forEach(push);
  off.forEach(push);
  branded.forEach(push);
  generic.slice(5).forEach(push);

  return NextResponse.json(out.slice(0, 30));
}
