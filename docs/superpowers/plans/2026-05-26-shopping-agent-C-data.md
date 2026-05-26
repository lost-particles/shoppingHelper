# Plan C — Data: Apify Wayfair Scrape and Transform

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the kickoff's 5 seed products with ~50 real Wayfair products + reviews scraped via Apify, normalized to the `Product`/`Review` contract from `lib/data/types.ts`. Cache the result to JSON so the chat agent reads from a static file (no live scraping at chat time).

**Architecture:** One-time scrape via an Apify Wayfair actor across 7 product-search queries. Dataset downloaded as JSON to `lib/data/raw-apify-dump.json`. A small Node script `scripts/transform-catalog.ts` maps the actor's output schema into our `Product` and `Review` shapes and writes `lib/data/catalog.json` and `lib/data/reviews.json`. Hard cap at 30 minutes — if Apify isn't producing usable output by the deadline, fall back to hand-curating 25 real Wayfair listings from wayfair.com.

**Tech Stack:** Apify (one-shot actor run) · TypeScript · Node `fs` · `tsx`

---

## Prerequisites

- The **Kickoff plan** ([2026-05-26-shopping-agent-0-kickoff.md](2026-05-26-shopping-agent-0-kickoff.md)) has been committed to `main`. Your worktree branches from a state where `lib/data/types.ts` exists and `lib/data/catalog.json` / `lib/data/reviews.json` contain seed data.
- `APIFY_TOKEN` is in `.env.local`.
- `pnpm install` has been run.

If any of the above is false, stop and run the Kickoff plan first.

---

## File Ownership

**You create / overwrite ONLY these files:**
- Create: `scripts/transform-catalog.ts`
- Create: `lib/data/raw-apify-dump.json` (the raw Apify download, kept for reference)
- Overwrite: `lib/data/catalog.json` (replaces seed with ~50 real products)
- Overwrite: `lib/data/reviews.json` (replaces seed with real reviews)

**Do NOT touch:**
- `lib/data/types.ts` — shared contract; treat as read-only
- `lib/tools/**` — owned by Plan A
- `lib/agents/**` — owned by Plan A
- `components/**` — owned by Plan B
- `next.config.ts`, `app/layout.tsx` — owned by Plan B

---

## Hard Cap

**30 minutes wall clock from Step C1.1 to a usable `catalog.json`.** If you're not there, jump to "Fallback: hand-curate." Do not sink the demo into a scraper rabbit hole.

---

## Tasks

### Task C1: Pick and test an Apify Wayfair actor

- [ ] **Step C1.1: Find a current Wayfair actor in the Apify Store**

Go to https://apify.com/store?search=wayfair. Pick the actor with **the most recent successful run** (last 30 days) and a non-zero star count. As of writing, candidates include `epctex/wayfair-scraper` and `tri_angle/wayfair-scraper` — the field changes, pick what's currently working. Record the actor ID (e.g. `epctex/wayfair-scraper`) — you'll need it later if you wire up programmatic calls.

- [ ] **Step C1.2: Read the actor's README**

What's the input shape? Some actors take `startUrls`, some `searchQueries`, some `keywords`. Note the field name and required vs. optional fields.

- [ ] **Step C1.3: Test run with 1 query / 3 items**

In the Apify Console for the actor, click "Try for free". Configure a minimal input — adjust field names to match the actor's README:

```json
{
  "startUrls": ["https://www.wayfair.com/keyword.php?keyword=armchair"],
  "maxItems": 3
}
```

Or, if the actor expects search terms:

```json
{
  "searchQueries": ["armchair"],
  "maxItems": 3
}
```

Click "Start". Wait 1-3 minutes for completion.

- [ ] **Step C1.4: Inspect the output schema**

Open the run's "Dataset" tab. Click on one item. **Write down the field names** in the actual output:

- Product name field: ___________ (often `productName`, `name`, or `title`)
- Price field: ___________ (often `price`, `salePrice`, or `currentPrice`)
- Image URL field: ___________ (often `imageUrl`, `image`, or `images[0]`)
- Description field: ___________ (often `description`)
- Rating field: ___________ (often `rating` or `averageRating`)
- Review count field: ___________ (often `reviewCount` or `numReviews`)
- Reviews array field: ___________ (often `reviews` — may not be present)

You'll use these in the transform script (Task C3). If the output is empty rows, broken HTML, or shows an anti-bot challenge page — **abort this actor and try another from C1.1**, or jump to the fallback if you've already burned 15 min on C1.

---

### Task C2: Full scrape

- [ ] **Step C2.1: Run with 7 categories**

Re-run the actor with the input expanded to all 7 product-search queries. Limit ~8 per query (target ~50 products):

```json
{
  "searchQueries": ["armchair", "sofa", "floor lamp", "area rug", "bookshelf", "coffee table", "desk"],
  "maxItems": 8
}
```

(Adjust field names to match the actor.) Some actors don't support multiple queries — run 7 single-query runs back-to-back and merge their datasets, or pick the multi-query actor in C1.1.

- [ ] **Step C2.2: Download the dataset**

When the run finishes, in the Dataset tab → "Export" → "JSON". Save to `lib/data/raw-apify-dump.json` in your worktree.

- [ ] **Step C2.3: Eyeball the dump**

```bash
head -100 lib/data/raw-apify-dump.json
```

Sanity-check: real product names, real prices, real Wayfair image URLs (`wfcdn.com` or similar). Count entries:

```bash
node -e 'console.log(JSON.parse(require("fs").readFileSync("lib/data/raw-apify-dump.json", "utf8")).length)'
```

Expected: ≥ 30. If fewer, decide whether to re-run with more `maxItems` or proceed.

---

### Task C3: Transform script

**File:** `scripts/transform-catalog.ts` (new)

- [ ] **Step C3.1: Install `tsx` if not present**

```bash
pnpm add -D tsx
```

- [ ] **Step C3.2: Create the transform script**

**Adjust the source field names in `RawItem` and inside `transform()` to match what you saw in Step C1.4.** The code below is a template — exact field names depend on the actor.

```typescript
import fs from "node:fs";
import path from "node:path";
import type { Product, Review, ProductCategory, ProductStyle } from "../lib/data/types";

interface RawItem {
  name?: string;
  productName?: string;
  title?: string;
  price?: number | string;
  imageUrl?: string;
  image?: string;
  images?: string[];
  description?: string;
  rating?: number;
  averageRating?: number;
  reviewCount?: number;
  numReviews?: number;
  reviews?: Array<{ rating?: number; title?: string; body?: string; text?: string }>;
  url?: string;
  category?: string;
  searchQuery?: string;
}

const QUERY_TO_CATEGORY: Record<string, ProductCategory> = {
  armchair: "chair",
  sofa: "sofa",
  "floor lamp": "lamp",
  "area rug": "rug",
  bookshelf: "shelf",
  "coffee table": "table",
  desk: "desk",
};

function inferStyles(text: string): ProductStyle[] {
  const t = text.toLowerCase();
  const styles: ProductStyle[] = [];
  if (/mid[- ]?century|midcentury/.test(t)) styles.push("midcentury");
  if (/scandi|nordic/.test(t)) styles.push("scandi");
  if (/boho|bohem/.test(t)) styles.push("boho");
  if (/industrial/.test(t)) styles.push("industrial");
  if (/farmhouse|rustic/.test(t)) styles.push("farmhouse");
  if (/traditional|classic/.test(t)) styles.push("traditional");
  if (/modern|contemporary/.test(t)) styles.push("modern");
  return styles.length ? styles : ["modern"];
}

function priceToNumber(p: unknown): number {
  if (typeof p === "number") return p;
  if (typeof p === "string") {
    const n = Number(p.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function transform() {
  const rawPath = path.join(process.cwd(), "lib/data/raw-apify-dump.json");
  const raw: RawItem[] = JSON.parse(fs.readFileSync(rawPath, "utf8"));

  const products: Product[] = [];
  const reviews: Review[] = [];

  raw.forEach((item, idx) => {
    const name = item.name ?? item.productName ?? item.title ?? `Wayfair Product ${idx}`;
    const price = priceToNumber(item.price);
    const imageUrl = item.imageUrl ?? item.image ?? item.images?.[0] ?? "";
    const description = item.description ?? "";
    const rating = item.rating ?? item.averageRating ?? 4.5;
    const reviewCount = item.reviewCount ?? item.numReviews ?? item.reviews?.length ?? 0;
    const queryKey = (item.searchQuery ?? "").toLowerCase();
    const category = QUERY_TO_CATEGORY[queryKey] ?? "chair";

    if (!name || !price || !imageUrl) return;

    const id = `${category}-${String(idx + 1).padStart(3, "0")}`;
    products.push({
      id,
      name,
      category,
      price,
      dimensions: { width: 0, depth: 0, height: 0, unit: "in" },
      materials: [],
      colors: [],
      styles: inferStyles(`${name} ${description}`),
      imageUrl,
      description,
      rating,
      reviewCount,
    });

    (item.reviews ?? []).slice(0, 4).forEach((r, ri) => {
      reviews.push({
        id: `r-${id}-${String.fromCharCode(97 + ri)}`,
        productId: id,
        rating: r.rating ?? 5,
        title: r.title ?? "Verified buyer",
        body: r.body ?? r.text ?? "",
        ownerMonths: Math.floor(Math.random() * 18) + 1,
      });
    });
  });

  fs.writeFileSync(
    path.join(process.cwd(), "lib/data/catalog.json"),
    JSON.stringify(products, null, 2),
  );
  fs.writeFileSync(
    path.join(process.cwd(), "lib/data/reviews.json"),
    JSON.stringify(reviews, null, 2),
  );

  console.log(`Wrote ${products.length} products and ${reviews.length} reviews.`);
}

transform();
```

- [ ] **Step C3.3: Run the transform**

```bash
pnpm tsx scripts/transform-catalog.ts
```

Expected: `Wrote N products and M reviews.` where N ≥ 30. If N is much lower than the raw dump size, the field-name mapping is wrong — open `raw-apify-dump.json`, look at one item, fix `RawItem` and the assignments in `transform()`, and re-run.

- [ ] **Step C3.4: Sanity-check the output**

```bash
head -60 lib/data/catalog.json
```

Verify: real Wayfair product names, prices that look right, image URLs containing `wfcdn.com` (or similar Wayfair domain).

```bash
grep -oE 'https://[^/"]+' lib/data/catalog.json | sort -u
```

Note all image hosts. **Report these to whoever owns Plan B / the merger** so the `next.config.ts` `remotePatterns` allowlist covers them. Plan B's default already includes `**.wfcdn.com`; if you see something else (`secure.cdn.wayfair.com`, `images.wayfair.com`, etc.), it needs to be added.

---

### Task C4: Augment reviews if thin

- [ ] **Step C4.1: Count reviews per product**

```bash
node -e '
const reviews = JSON.parse(require("fs").readFileSync("lib/data/reviews.json", "utf8"));
const counts = {};
reviews.forEach(r => counts[r.productId] = (counts[r.productId] || 0) + 1);
const avg = reviews.length / Object.keys(counts).length;
console.log(`Avg reviews per product: ${avg.toFixed(1)}`);
console.log(`Products with 0 reviews: ${JSON.parse(require("fs").readFileSync("lib/data/catalog.json", "utf8")).filter(p => !counts[p.id]).length}`);
'
```

- [ ] **Step C4.2: Hand-write reviews for top 6 candidates if average < 2**

If the average is below 2 or many products have zero reviews, hand-write 2 reviews each for the 6 products most likely to appear in the hero demo. Pick from these categories at price $200-$800:
- 2 armchairs (small, warm tones)
- 1 floor lamp
- 1 small rug
- 1 bookshelf
- 1 accent / coffee table

Each hand-written review must mention a real tradeoff (firmness, color in different lighting, assembly difficulty, pet behavior, doorway fit). **This is what makes the agent sound credible vs. generic.**

Append directly to `lib/data/reviews.json` following the existing shape. Make sure `productId` references a real `id` from `catalog.json`.

---

### Task C5: Verify and commit

- [ ] **Step C5.1: TypeScript clean**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step C5.2: Commit**

```bash
git add scripts/transform-catalog.ts lib/data/raw-apify-dump.json lib/data/catalog.json lib/data/reviews.json
git commit -m "feat(C): scrape real Wayfair catalog via Apify, normalize to schema"
```

- [ ] **Step C5.3: Push the branch**

```bash
git push origin <your-branch-name>
```

Ready for merge.

---

## Fallback: Hand-Curate (only if Apify aborted)

If Tasks C1-C2 didn't produce a usable dump within 15 minutes, abandon Apify and do this. Plan to spend 30-40 minutes total. Skip Task C3 entirely.

- [ ] **Fallback F1: Open wayfair.com and pick 25 real products**

Search these queries on wayfair.com, click into products that look hero-demo-friendly (small footprint, $100-$800, warm tones available):

- 6 armchairs / accent chairs
- 4 floor lamps
- 4 area rugs (5x8 or smaller)
- 3 bookshelves
- 3 coffee or accent tables
- 3 small desks
- 2 small sofas

- [ ] **Fallback F2: Build `lib/data/catalog.json` by hand**

For each product, copy into the JSON:
- `id`: stable slug like `chair-001`, incrementing within category
- `name`: the real product name (e.g. "Wade Logan® Janyiah Tufted Velvet Armchair")
- `category`: matching `ProductCategory`
- `price`: current sale price as a number
- `dimensions`: from the product details (use zeros if not shown)
- `materials`: from the product details, as an array
- `colors`: visible color options
- `styles`: inferred from name + description, as `ProductStyle[]`
- `imageUrl`: right-click the main product image → "Copy image address". Must be `https://` from a Wayfair CDN. **Note the hostname** — report it to whoever owns Plan B so they can add to `next.config.ts` if not already in the allowlist.
- `description`: 1-2 sentences from the page (paraphrase if long)
- `rating`: star rating shown
- `reviewCount`: review count shown

Same schema as `lib/data/types.ts`.

- [ ] **Fallback F3: Build `lib/data/reviews.json` by hand**

For each product, copy 2 real reviews from the product page's review tab (or write 2 plausible ones if the page has no reviews). Use the existing seed JSON's shape. Mix opinions — at least one review per hero-candidate should mention a real tradeoff (firmness, color in different lighting, assembly difficulty, pet behavior, doorway fit).

- [ ] **Fallback F4: Verify and commit**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Then:

```bash
git add lib/data/catalog.json lib/data/reviews.json
git commit -m "feat(C): hand-curate 25 real Wayfair products and reviews"
git push origin <your-branch-name>
```

---

## Return Summary

When done, report:
- Apify or hand-curated? Why?
- Final product count and review count
- Image hostnames in the catalog (so Plan B / merger can update `next.config.ts` if needed)
- Any deviations from the plan
- Branch name to merge from

## Out of Scope for Plan C

- Live scraping at chat time (Apify runs are 10-60s — fatal for the demo recording)
- Trying multiple Apify actors back-to-back past the 15-min cap (use the hand-curated fallback instead)
- Touching agent / tool / UI code (Plans A and B own)
- Modifying `lib/data/types.ts` (shared contract)
- Writing UI for "refresh catalog" — the demo can mention it without depending on it
