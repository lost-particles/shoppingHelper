import fs from "node:fs";
import path from "node:path";
import type { Product, Review, ProductCategory, ProductStyle } from "../lib/data/types";

// piotrv1001/wayfair-listings-scraper output schema
interface RawItem {
  sku?: string;
  name?: string;
  url?: string;
  price?: number | string;
  previousPrice?: number | string;
  currency?: string;
  discountPercent?: number;
  rating?: number;
  reviewCount?: number;
  leadImage?: string;
  variantCountText?: string;
  flag?: string;
  speedBadge?: string;
  estimatedArrival?: string;
  isBestValue?: boolean;
  categoryBreadcrumbs?: string[];
  sourceUrl?: string;
  scrapedAt?: string;
}

const ITEMS_PER_CATEGORY = 8;

const SOURCE_KEYWORD_TO_CATEGORY: Record<string, ProductCategory> = {
  armchair: "chair",
  sofa: "sofa",
  lamp: "lamp",
  rug: "rug",
  bookshelf: "shelf",
  coffee: "table",
  desk: "desk",
};

function inferCategory(item: RawItem): ProductCategory {
  const src = (item.sourceUrl ?? "").toLowerCase();
  for (const [kw, cat] of Object.entries(SOURCE_KEYWORD_TO_CATEGORY)) {
    if (src.includes(kw)) return cat;
  }
  const name = (item.name ?? "").toLowerCase();
  const kws: [string, ProductCategory][] = [
    ["armchair", "chair"], ["chair", "chair"], ["sofa", "sofa"], ["couch", "sofa"],
    ["lamp", "lamp"], ["rug", "rug"], ["shelf", "shelf"], ["bookcase", "shelf"],
    ["table", "table"], ["desk", "desk"], ["bed", "bed"],
  ];
  for (const [kw, cat] of kws) {
    if (name.includes(kw)) return cat;
  }
  return "chair";
}

function inferStyles(text: string): ProductStyle[] {
  const t = text.toLowerCase();
  const styles: ProductStyle[] = [];
  if (/mid[- ]?century|midcentury/.test(t)) styles.push("midcentury");
  if (/scandi|nordic|danish/.test(t)) styles.push("scandi");
  if (/boho|bohem|eclectic/.test(t)) styles.push("boho");
  if (/industrial|loft/.test(t)) styles.push("industrial");
  if (/farmhouse|rustic|country/.test(t)) styles.push("farmhouse");
  if (/traditional|classic|ornate/.test(t)) styles.push("traditional");
  if (/modern|contemporary|minimali/.test(t)) styles.push("modern");
  return styles.length ? styles : ["modern"];
}

function priceToNumber(p: unknown): number {
  if (typeof p === "number" && p > 0) return Math.round(p * 100) / 100;
  if (typeof p === "string") {
    const n = Number(p.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100) / 100;
  }
  return 0;
}

function transform() {
  const rawPath = path.join(process.cwd(), "lib/data/raw-apify-dump.json");
  if (!fs.existsSync(rawPath)) {
    console.error("lib/data/raw-apify-dump.json not found.");
    process.exit(1);
  }

  const raw: RawItem[] = JSON.parse(fs.readFileSync(rawPath, "utf8"));
  console.log(`Raw items: ${raw.length}`);

  // Group by category, deduplicate by name, pick up to ITEMS_PER_CATEGORY each
  const buckets = new Map<ProductCategory, RawItem[]>();
  const seenNames = new Set<string>();

  for (const item of raw) {
    const price = priceToNumber(item.price);
    const imageUrl = item.leadImage ?? "";
    if (!item.name || !price || !imageUrl.startsWith("http")) continue;

    const nameKey = item.name.toLowerCase().trim();
    if (seenNames.has(nameKey)) continue;
    seenNames.add(nameKey);

    const cat = inferCategory(item);
    const bucket = buckets.get(cat) ?? [];
    if (bucket.length < ITEMS_PER_CATEGORY) {
      bucket.push(item);
      buckets.set(cat, bucket);
    }
  }

  const products: Product[] = [];
  const reviews: Review[] = [];

  for (const [category, items] of buckets.entries()) {
    for (const item of items) {
      const id = `${category}-${String(products.length + 1).padStart(3, "0")}`;
      const name = item.name!;
      const breadcrumbs = item.categoryBreadcrumbs ?? [];

      products.push({
        id,
        name,
        category,
        price: priceToNumber(item.price),
        dimensions: { width: 0, depth: 0, height: 0, unit: "in" },
        materials: [],
        colors: item.variantCountText?.includes("Color") ? [] : [],
        styles: inferStyles(`${name} ${breadcrumbs.join(" ")}`),
        imageUrl: item.leadImage!,
        description: breadcrumbs.length > 2
          ? breadcrumbs.slice(2).join(" > ")
          : "",
        rating: item.rating ?? 4.5,
        reviewCount: item.reviewCount ?? 0,
        url: item.url,
      });
    }
  }

  fs.writeFileSync(
    path.join(process.cwd(), "lib/data/catalog.json"),
    JSON.stringify(products, null, 2),
  );
  fs.writeFileSync(
    path.join(process.cwd(), "lib/data/reviews.json"),
    JSON.stringify(reviews, null, 2),
  );

  console.log(`\nWrote ${products.length} products and ${reviews.length} reviews.`);
  console.log("Category breakdown:");
  const counts = new Map<string, number>();
  for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  for (const [cat, n] of counts) console.log(`  ${cat}: ${n}`);

  const hosts = new Set<string>();
  for (const p of products) {
    try { hosts.add(new URL(p.imageUrl).hostname); } catch { /* skip */ }
  }
  console.log(`\nImage hostnames (for Plan B next.config.ts):\n  ${[...hosts].join("\n  ")}`);
}

transform();
