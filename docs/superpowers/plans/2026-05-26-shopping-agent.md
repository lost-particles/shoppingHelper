# Shopping Agent Implementation Plan (Overview)

> **⚠️ THIS PLAN HAS BEEN SPLIT FOR PARALLEL EXECUTION**
>
> Three agents can run concurrently in isolated worktrees after a small shared kickoff lands on `main`:
>
> 1. **[Kickoff](2026-05-26-shopping-agent-0-kickoff.md)** — Run first, single agent, commit to `main`. Creates the shared `Product`/`Review` type contract and 5 seed products so A and B can verify before C delivers the real catalog.
> 2. **[Plan A — Backend](2026-05-26-shopping-agent-A-backend.md)** — Owns `lib/tools/shopping.ts`, `lib/tools/index.ts`, `lib/agents/index.ts`.
> 3. **[Plan B — Frontend](2026-05-26-shopping-agent-B-frontend.md)** — Owns `components/product-card.tsx`, `components/chat-app.tsx`, `next.config.ts`, `app/layout.tsx`.
> 4. **[Plan C — Data](2026-05-26-shopping-agent-C-data.md)** — Owns `scripts/transform-catalog.ts`, `lib/data/raw-apify-dump.json`, and overwrites `lib/data/catalog.json` + `lib/data/reviews.json`.
>
> **File ownership is disjoint** — no two agents touch the same file, so merges are conflict-free.
>
> **Use this file** as the full-picture reference (architecture, tech stack, time budget, out-of-scope, demo script). **Execute from the four files above.**
>
> ---

**For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A conversational furniture-shopping agent that asks 1-2 clarifying questions, searches a **real Wayfair catalog** (~50 products scraped via Apify, cached to JSON) with tools, and returns 2-3 curated recommendations with reasoning grounded in product details and reviews. Hero demo is a single ambiguous scenario where the agent disambiguates → searches → explains tradeoffs.

**Architecture:** A one-time **Apify scrape** of Wayfair produces a static `catalog.json` (~50 real products with names, prices, Wayfair CDN image URLs, descriptions, ratings, and reviews). Three Zod-typed AI SDK tools (`searchProducts`, `getProductDetails`, `getReviews`) read from this cached JSON — *no live scraping at chat time* so the demo is fast and reliable. Rewrite the chat agent's `instructions` to drive a clarify → search → recommend flow on `subconsciousModel` via `ToolLoopAgent`. Extend `chat-app.tsx`'s tool-part rendering so `tool-searchProducts` outputs render as a product card grid using a new `<ProductCard>` component. The Apify actor stays runnable on demand — the demo can mention "fresh data is one button away" without depending on it live.

**Tech Stack:** Next.js 16 (App Router) · React 19 · Vercel AI SDK v6 (`ToolLoopAgent`, `useChat`, `createAgentUIStreamResponse`) · Subconscious `tim-qwen3.6-27b` (OpenAI-compatible) · Tailwind v4 · TypeScript · Zod · pnpm · **Apify** (one-shot Wayfair scrape)

**Hackathon constraints driving this plan:**
- 2 hours total, 3 people working in parallel
- No test framework in repo — verification is manual (curl + browser)
- Demo is a 60-second screen recording, so the hero scenario matters more than coverage
- All steps include a verify substep before commit; commit after every working slice
- **Apify is a 15-minute hard cap.** If the scrape isn't producing usable JSON by 0:30 wall clock, Person C falls back to hand-curating 25 real Wayfair listings (copying name/price/image URL/description by hand from wayfair.com into JSON). The agent and UI code is identical either way — only the data source changes.

**Role split:**
- **A — Backend/Agent:** Tasks 1, 3, 4, 6
- **B — Frontend:** Tasks 5, 7
- **C — Data + Demo:** Task 2 first, then takes over demo prep at the 1h mark (scenarios, video script, recording)

---

## File Structure

**New files:**
- `lib/data/catalog.json` — ~30 product records (id, name, category, price, dimensions, materials, colors, styles, imageUrl, description, rating, reviewCount)
- `lib/data/reviews.json` — 4-6 reviews per product, keyed by `productId`
- `lib/data/types.ts` — Shared `Product`, `Review` TypeScript types
- `lib/tools/shopping.ts` — `searchProducts`, `getProductDetails`, `getReviews` AI SDK tools
- `components/product-card.tsx` — Product card with image, name, price, fit-reason
- `.env.local` — `SUBCONSCIOUS_API_KEY` (gitignored)

**Modified files:**
- `lib/tools/index.ts` — swap `getWeather`/`calculate` out of `chatTools`, add shopping tools
- `lib/agents/index.ts` — rewrite `CHAT_INSTRUCTIONS` to shopping persona
- `components/chat-app.tsx` — extend `MessagePart` to render product cards on `tool-searchProducts` output; update empty-state suggestions
- `next.config.ts` — add `images.remotePatterns` for `images.unsplash.com`

**Files we deliberately do NOT touch:**
- `lib/subconscious.ts` — provider works as-is
- `app/api/chat/route.ts` — already streams correctly
- `lib/tools/mcp-tools.ts` — out of scope for chat mode
- `lib/agents/index.ts` `researchAgent` — chat agent only for the demo

---

## Pre-Flight (everyone, 0:00-0:15)

- [ ] **Step P1: Install deps**

```bash
pnpm install
```

Expected: completes without errors, `node_modules/` appears.

- [ ] **Step P2: Get the API key**

Sign up at https://www.subconscious.dev/platform, copy the `sky_...` key.

- [ ] **Step P3: Create `.env.local`**

```bash
echo "SUBCONSCIOUS_API_KEY=sky_your_actual_key_here" > .env.local
echo "APIFY_TOKEN=apify_api_your_actual_token_here" >> .env.local
```

Apify token: sign up at https://apify.com/ (free tier includes $5/mo credits, plenty for one scrape run). Get the token at https://console.apify.com/settings/integrations.

- [ ] **Step P4: Start dev server (in a dedicated terminal, leave running)**

```bash
pnpm dev
```

Expected: `▲ Next.js 16.2.6 ... Local: http://localhost:3000`. Open it, send "hello" in Chat mode, confirm a reply comes back.

- [ ] **Step P5: Agree on the hero demo scenario** (5 min, all three)

Lock the *exact* user message you'll demo. Recommended:
> "Setting up a reading nook in a small Boston apartment, budget around $800. I want it cozy but not cluttered — warm tones, no minimalist white box. What should I get?"

Write it in a shared doc. Every subsequent decision serves this scenario.

---

## Task 1: Product types and tool stubs (Person A)

**Files:**
- Create: `lib/data/types.ts`
- Create: `lib/tools/shopping.ts`

- [ ] **Step 1.1: Define types**

Create `lib/data/types.ts`:

```typescript
export type ProductCategory =
  | "sofa" | "chair" | "table" | "bed" | "lamp" | "rug" | "shelf" | "desk";

export type ProductStyle =
  | "modern" | "scandi" | "boho" | "industrial" | "farmhouse" | "midcentury" | "traditional";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  dimensions: { width: number; depth: number; height: number; unit: "in" };
  materials: string[];
  colors: string[];
  styles: ProductStyle[];
  imageUrl: string;
  description: string;
  rating: number;
  reviewCount: number;
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  ownerMonths: number;
}
```

- [ ] **Step 1.2: Create the tools file with stubs**

Create `lib/tools/shopping.ts`:

```typescript
import { tool } from "ai";
import { z } from "zod";
import catalogData from "@/lib/data/catalog.json";
import reviewsData from "@/lib/data/reviews.json";
import type { Product, Review } from "@/lib/data/types";

const catalog = catalogData as Product[];
const reviews = reviewsData as Review[];

export const searchProducts = tool({
  description:
    "Search the Wayfair furniture catalog. Use natural language for `query` (e.g. 'cozy reading chair warm tones'). Apply filters when the user specifies a budget, room, or category. Returns up to `limit` ranked matches with a short reason each is a fit.",
  inputSchema: z.object({
    query: z.string().describe("Natural-language description of what the user wants"),
    category: z
      .enum(["sofa", "chair", "table", "bed", "lamp", "rug", "shelf", "desk"])
      .optional(),
    maxPrice: z.number().positive().optional(),
    styles: z
      .array(z.enum(["modern", "scandi", "boho", "industrial", "farmhouse", "midcentury", "traditional"]))
      .optional()
      .describe("Style tags to match (any-of)"),
    limit: z.number().min(1).max(6).default(3),
  }),
  execute: async ({ query, category, maxPrice, styles, limit }) => {
    const q = query.toLowerCase();
    const scored = catalog
      .filter((p) => !category || p.category === category)
      .filter((p) => !maxPrice || p.price <= maxPrice)
      .filter((p) => !styles?.length || p.styles.some((s) => styles.includes(s)))
      .map((p) => {
        const haystack = `${p.name} ${p.description} ${p.materials.join(" ")} ${p.colors.join(" ")} ${p.styles.join(" ")}`.toLowerCase();
        const terms = q.split(/\s+/).filter((t) => t.length > 2);
        const hits = terms.filter((t) => haystack.includes(t)).length;
        return { product: p, score: hits + p.rating / 5 };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ product }) => product);

    return { query, count: scored.length, products: scored };
  },
});

export const getProductDetails = tool({
  description:
    "Fetch full details for a single product by id. Use after searchProducts when the user picks one or you need dimensions/materials to answer a fit question.",
  inputSchema: z.object({
    productId: z.string(),
  }),
  execute: async ({ productId }) => {
    const product = catalog.find((p) => p.id === productId);
    if (!product) return { error: `No product with id ${productId}` };
    return { product };
  },
});

export const getReviews = tool({
  description:
    "Fetch customer reviews for a product. Pass `topic` to bias which reviews come back (e.g. 'comfort after 6 months', 'pet-friendly').",
  inputSchema: z.object({
    productId: z.string(),
    topic: z.string().optional(),
    limit: z.number().min(1).max(5).default(3),
  }),
  execute: async ({ productId, topic, limit }) => {
    const all = reviews.filter((r) => r.productId === productId);
    const ranked = topic
      ? all
          .map((r) => {
            const text = `${r.title} ${r.body}`.toLowerCase();
            const terms = topic.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
            const hits = terms.filter((t) => text.includes(t)).length;
            return { review: r, score: hits };
          })
          .sort((a, b) => b.score - a.score)
          .map(({ review }) => review)
      : all;
    return { productId, topic, reviews: ranked.slice(0, limit) };
  },
});

export const shoppingTools = {
  searchProducts,
  getProductDetails,
  getReviews,
};
```

- [ ] **Step 1.3: Commit (data files don't exist yet — TS will complain, that's fine, Person C is on it)**

```bash
git add lib/data/types.ts lib/tools/shopping.ts
git commit -m "feat: scaffold shopping tools with Zod schemas"
```

---

## Task 2: Scrape real Wayfair catalog via Apify (Person C, runs in parallel with Task 1)

**Hard cap: 30 minutes wall clock from Task 2.1 to usable catalog.json. If you're not there by 0:45 in the timeline, jump to the "Fallback: hand-curate" subtask. Don't sink the demo into a scraper rabbit hole.**

**Files:**
- Create: `scripts/transform-catalog.ts` (raw Apify dump → our `Product`/`Review` schema)
- Create: `lib/data/raw-apify-dump.json` (the raw scrape output, kept for reference)
- Create: `lib/data/catalog.json` (normalized)
- Create: `lib/data/reviews.json` (extracted from the scrape or augmented by hand)

- [ ] **Step 2.1: Pick a Wayfair actor in the Apify Store**

Go to https://apify.com/store?search=wayfair. Pick the actor with the **most recent successful run** (last 30 days) and a non-zero star count. As of writing, candidates include `epctex/wayfair-scraper` and `tri_angle/wayfair-scraper` — the field may have changed; pick what's currently working. Note the actor ID (e.g. `epctex/wayfair-scraper`).

- [ ] **Step 2.2: Test run with 1 query / 3 items**

In the Apify Console for the actor, click "Try for free". Configure a minimal input:

```json
{
  "startUrls": ["https://www.wayfair.com/keyword.php?keyword=armchair"],
  "maxItems": 3
}
```

(Actual field names depend on the actor — read its README. Some use `searchQueries`, some use `startUrls`, some use `keywords`.)

Click "Start". Wait for the run to complete (1-3 min).

- [ ] **Step 2.3: Inspect the output schema**

Open the run's "Dataset" tab. Click on one item. **Write down the field names** — what's the product name field? Price? Image URL? Description? Are reviews included? Star rating? You'll map these in Step 2.6.

If the output looks unusable (broken HTML, empty fields, anti-bot challenge page) — **abort this actor**, try another one from Step 2.1, or jump to the fallback.

- [ ] **Step 2.4: Full scrape across categories**

Once one actor proves itself in Step 2.3, run it with these 7 queries, limit ~8 per query (target ~50 products total):

```
armchair
sofa
floor lamp
area rug
bookshelf
coffee table
desk
```

Run it. Wait. While waiting, sketch the schema mapping in your head.

- [ ] **Step 2.5: Download the dataset**

When the run finishes, in the Dataset tab → "Export" → "JSON". Save to `lib/data/raw-apify-dump.json`. Eyeball it — is the data sane? Real product names, real prices, real Wayfair image URLs?

- [ ] **Step 2.6: Write the transform script**

Create `scripts/transform-catalog.ts`. **Adjust the source field names to match what you actually saw in Step 2.3** — the code below is a template, not a contract.

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
  reviewCount?: number;
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
    const rating = item.rating ?? 4.5;
    const reviewCount = item.reviewCount ?? item.reviews?.length ?? 0;
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

Run it:

```bash
pnpm tsx scripts/transform-catalog.ts
```

(If `tsx` isn't installed: `pnpm add -D tsx` first.)

Expected output: `Wrote N products and M reviews.` where N ≥ 30 and M ≥ 30.

- [ ] **Step 2.7: Sanity-check the normalized catalog**

```bash
head -60 lib/data/catalog.json
```

Verify: real Wayfair product names, prices that look right, image URLs containing `wfcdn.com` or similar. If image URLs use a different host, add that host to `next.config.ts` `remotePatterns` in Task 5.

- [ ] **Step 2.8: Augment reviews if thin**

If the scrape returned fewer than 2 reviews per product on average, **hand-write 2 reviews each for your top 6 candidate hero products** (the ones most likely to show up in the demo scenario — small armchairs, floor lamps, rugs around $300-$800). Each review should mention a real tradeoff: firmness, color in different lighting, assembly difficulty, pet behavior, fit through doorways. These are what make the agent sound credible vs. generic.

Pattern to follow:

```json
{
  "id": "r-chair-001-z",
  "productId": "chair-001",
  "rating": 4,
  "title": "Great looking, less great for napping",
  "body": "Beautiful chair, the linen has held up well to two cats. Honest note: the cushion is on the firm side. For reading or working from a tablet, it's perfect.",
  "ownerMonths": 14
}
```

- [ ] **Step 2.9: Verify TypeScript is happy**

```bash
pnpm tsc --noEmit 2>&1 | head -30
```

Expected: no errors about `lib/tools/shopping.ts` imports.

- [ ] **Step 2.10: Commit**

```bash
git add scripts/transform-catalog.ts lib/data/raw-apify-dump.json lib/data/catalog.json lib/data/reviews.json
git commit -m "feat: scrape real Wayfair catalog via Apify, normalize to schema"
```

---

### Fallback: hand-curate (only if Apify aborted)

If Step 2.1-2.5 didn't produce a usable scrape by **0:45 wall clock**, abandon Apify and do this instead. Plan to spend 30-40 minutes.

- [ ] **Fallback Step F1: Open wayfair.com and pick 25 real products**

In your browser, search these queries on wayfair.com, click into products that look hero-demo-friendly (small footprint, $100-$800, warm tones available), aim for spread across categories:
- 6 armchairs / accent chairs
- 4 floor lamps
- 4 area rugs (5x8 or smaller)
- 3 bookshelves
- 3 coffee or accent tables
- 3 small desks
- 2 sofas

- [ ] **Fallback Step F2: Build catalog.json by hand**

For each product clicked, copy into `lib/data/catalog.json`:
- `name`: the real product name (e.g. "Wade Logan® Janyiah Tufted Velvet Armchair")
- `price`: current sale price as a number
- `imageUrl`: right-click the main product image → "Copy image address". Must start with `https://` and be from a Wayfair CDN (`secure.img1-fg.wfcdn.com`, `assets.wfcdn.com`, etc.). Note the host — you'll add it to `next.config.ts` in Task 5.
- `description`: 1-2 sentences from the product description (paraphrase if very long)
- `rating`: the star rating shown (e.g. 4.6)
- `reviewCount`: the review count shown
- `category`, `styles`, `colors`, `materials`: infer from the page

Use the same schema as Task 1 defines.

- [ ] **Fallback Step F3: Build reviews.json by hand**

For each product, copy 2 real reviews from the product page's review tab (or write 2 plausible ones if the page has no reviews). Mix opinions — at least one review per hero-candidate product should mention a real tradeoff.

- [ ] **Fallback Step F4: Add the Wayfair CDN host to next.config.ts**

You'll do this in Task 5, but note now which host the image URLs use so Person B knows.

- [ ] **Fallback Step F5: Verify and commit**

```bash
pnpm tsc --noEmit 2>&1 | head -30
git add lib/data/catalog.json lib/data/reviews.json
git commit -m "feat: hand-curate 25 real Wayfair products and reviews"
```

---

## Task 3: Wire shopping tools into the chat agent (Person A)

**Files:**
- Modify: `lib/tools/index.ts`

- [ ] **Step 3.1: Replace chatTools to use shopping tools**

Edit `lib/tools/index.ts`. Find this block at the bottom:

```typescript
export const chatTools = {
  getWeather,
  calculate,
};
```

Replace with:

```typescript
import { shoppingTools } from "./shopping";

export const chatTools = {
  ...shoppingTools,
};
```

Leave `agentTools` alone — research mode still uses the originals for now.

- [ ] **Step 3.2: Verify the dev server hot-reloads without errors**

Check the terminal running `pnpm dev`. No compile errors.

- [ ] **Step 3.3: Smoke-test the tool from the UI**

Open http://localhost:3000, Chat mode, send: `Find me an armchair under $500.`

Expected: agent calls `searchProducts`, the UI shows a "Tool: searchProducts / Done" chip. Reply text mentions specific products from the catalog.

- [ ] **Step 3.4: Commit**

```bash
git add lib/tools/index.ts
git commit -m "feat: wire shopping tools into chat agent"
```

---

## Task 4: Rewrite the chat agent instructions (Person A)

**Files:**
- Modify: `lib/agents/index.ts:6-10`

- [ ] **Step 4.1: Replace CHAT_INSTRUCTIONS**

Edit `lib/agents/index.ts`. Replace the existing `CHAT_INSTRUCTIONS` constant with:

```typescript
const CHAT_INSTRUCTIONS = `You are a Wayfair shopping concierge. You help people pick furniture by talking with them like a thoughtful friend who happens to know the catalog.

How to behave:
- If the user's request is missing key info (room size, budget, style preference, color tones), ask ONE focused clarifying question first. Never ask more than two questions in a row — start recommending after that.
- Use the searchProducts tool to find candidates. Pass styles and budget filters when the user mentioned them.
- Use getReviews when a specific concern comes up (pet-friendly, comfort, durability, fit through doorways). Cite what reviewers actually said.
- Return 2-3 picks, not 10. For each pick, write one short sentence on WHY it fits this person specifically. No generic "this is a great chair" filler.
- Be honest about tradeoffs. If a product is firm, say so. Reviewers' criticisms are a feature of your recommendations, not a bug.
- When recommending products, always call searchProducts so the UI can render cards. Don't list products in plain text only.

Tone: warm, specific, no marketing fluff. You're a friend, not a salesperson.`;
```

- [ ] **Step 4.2: Verify the agent uses the new persona**

In the running UI, refresh, send the hero demo prompt:
> "Setting up a reading nook in a small Boston apartment, budget around $800. I want it cozy but not cluttered — warm tones, no minimalist white box. What should I get?"

Expected: agent either asks ONE focused clarifying question OR goes straight to searchProducts. Reply explains *why* each pick fits a small warm-toned reading nook.

- [ ] **Step 4.3: Commit**

```bash
git add lib/agents/index.ts
git commit -m "feat: shopping concierge agent prompt"
```

---

## Task 5: ProductCard component (Person B, can start as soon as Task 1 is committed)

**Files:**
- Create: `components/product-card.tsx`
- Modify: `next.config.ts`

- [ ] **Step 5.1: Allow Wayfair CDN images in Next.js**

Edit `next.config.ts`. Replace the contents with:

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "secure.img1-fg.wfcdn.com" },
      { protocol: "https", hostname: "secure.img2-fg.wfcdn.com" },
      { protocol: "https", hostname: "assets.wfcdn.com" },
      { protocol: "https", hostname: "**.wfcdn.com" },
    ],
  },
};

export default nextConfig;
```

**Cross-check with Task 2:** open `lib/data/catalog.json`, grep the image URLs for `hostname` values:

```bash
grep -oE 'https://[^/]+' lib/data/catalog.json | sort -u
```

If you see a host not in the list above, add it. If Next.js Image still complains, that's why.

- [ ] **Step 5.2: Build the card**

Create `components/product-card.tsx`:

```typescript
import Image from "next/image";
import type { Product } from "@/lib/data/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 transition hover:border-[#FF5C28]/60">
      <div className="relative aspect-[4/3] w-full bg-zinc-900">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes="(max-width: 768px) 50vw, 280px"
          className="object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-white">{product.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-[#FF5C28]">
            ${product.price}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>★ {product.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{product.reviewCount} reviews</span>
          <span>·</span>
          <span className="capitalize">{product.styles[0]}</span>
        </div>
        <p className="line-clamp-2 text-xs text-zinc-400">{product.description}</p>
      </div>
    </div>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  if (!products.length) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        No matches in the catalog.
      </p>
    );
  }
  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git add components/product-card.tsx next.config.ts
git commit -m "feat: ProductCard and ProductGrid components"
```

---

## Task 6: Render product cards in chat (Person B)

**Files:**
- Modify: `components/chat-app.tsx:44-60` (the `tool-` branch of `MessagePart`)

- [ ] **Step 6.1: Add the import**

Edit `components/chat-app.tsx`. After the existing imports at the top, add:

```typescript
import { ProductGrid } from "@/components/product-card";
import type { Product } from "@/lib/data/types";
```

- [ ] **Step 6.2: Render searchProducts output as a grid**

In `components/chat-app.tsx`, find the block starting at line 44 (the `if (part.type.startsWith("tool-"))` branch). Replace the entire `if (part.type.startsWith("tool-"))` block with:

```typescript
  if (part.type.startsWith("tool-")) {
    const label = part.type.replace("tool-", "");
    const state = "state" in part ? part.state : "unknown";

    if (
      part.type === "tool-searchProducts" &&
      state === "output-available" &&
      "output" in part &&
      part.output &&
      typeof part.output === "object" &&
      "products" in part.output
    ) {
      const products = (part.output as { products: Product[] }).products;
      return (
        <div key={`${messageId}-tool-${index}`}>
          <div className="rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-1.5 text-xs">
            <span className="font-medium text-[#FF5C28]">Found {products.length} picks</span>
          </div>
          <ProductGrid products={products} />
        </div>
      );
    }

    return (
      <div
        key={`${messageId}-tool-${index}`}
        className="mt-2 rounded-lg border border-[#FF5C28]/30 bg-[rgb(255_92_40/0.12)] px-3 py-2 text-xs"
      >
        <div className="font-medium text-[#FF5C28]">Tool: {label}</div>
        <div className="mt-1 text-zinc-400">
          {state === "input-available" && "Calling…"}
          {state === "output-available" && "Done"}
          {state === "output-error" && "Error"}
        </div>
      </div>
    );
  }
```

- [ ] **Step 6.3: Update the empty-state suggestions**

In `components/chat-app.tsx`, find the empty-state `<ul>` (around line 184). Replace its contents with shopping prompts:

```typescript
              <ul className="mt-4 max-w-md space-y-2 text-sm">
                <li>"I need a reading chair for a small apartment, under $500"</li>
                <li>"Cozy reading nook, warm tones, around $800 total"</li>
                <li>"Is the Linen Slope Armchair good for cats?"</li>
                <li>"Compare two midcentury floor lamps for me"</li>
              </ul>
```

- [ ] **Step 6.4: Verify in browser**

Hard-refresh http://localhost:3000. Send the hero prompt. Expected: product cards appear as a 2-3 column grid below the agent's text, each with image + name + price + rating.

If images don't load: confirm `next.config.ts` was saved and `pnpm dev` picked it up (it auto-restarts on config change; if not, kill and restart).

- [ ] **Step 6.5: Commit**

```bash
git add components/chat-app.tsx
git commit -m "feat: render searchProducts output as product card grid"
```

---

## Task 7: Hero demo polish (whoever finishes their stream first, ~1:30 mark)

**Files:**
- Modify: `components/chat-app.tsx` (header copy)
- Modify: `app/layout.tsx` (page title)

- [ ] **Step 7.1: Update the header**

In `components/chat-app.tsx` find:

```typescript
            <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
              Hackathon Starter
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Chat + Agents on Subconscious
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Wayfair · Subconscious · Baseten · Cloudflare
            </p>
```

Replace with:

```typescript
            <p className="text-xs font-medium uppercase tracking-wider text-[#FF5C28]">
              Wayfair Concierge
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white">
              Shop by Conversation
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Tell me about your space. I&apos;ll find pieces that fit.
            </p>
```

- [ ] **Step 7.2: Update page title**

In `app/layout.tsx`, find the `metadata` export and set:

```typescript
export const metadata: Metadata = {
  title: "Wayfair Concierge",
  description: "Shop furniture by conversation.",
};
```

(If the field name doesn't exactly match what's there, do the equivalent.)

- [ ] **Step 7.3: Walk through the hero scenario end-to-end**

Open a fresh incognito window, http://localhost:3000. Send the locked hero prompt verbatim. Capture:
- The agent's clarifying question (or direct picks)
- 2-3 product cards
- Reasoning per pick that's specific (mentions "small apartment", "warm tones", or "cozy")
- One follow-up: "Tell me more about the [pick]" → agent calls `getProductDetails` and `getReviews`

If anything in this flow is weak (generic recommendations, no review citation, ugly UI), fix THIS path, not the general system. Time is up at 1:45.

- [ ] **Step 7.4: Commit**

```bash
git add components/chat-app.tsx app/layout.tsx
git commit -m "feat: rebrand UI as Wayfair Concierge for demo"
```

---

## Task 8: Record and submit (Person C, 1:45-2:00)

- [ ] **Step 8.1: Write the 60-second script**

Three beats:
1. (10s) "Wayfair has 22M customers a year. Most still shop with filters and search bars. We built a concierge that shops with you."
2. (35s) Live demo of hero scenario — show the conversation, the cards, click into reviews if time allows.
3. (15s) "Three tools, one agent, grounded in **real Wayfair products** pulled via Apify. Subconscious-powered. Try it at [URL]."

- [ ] **Step 8.2: Record**

Use QuickTime (Cmd+Shift+5 on Mac) → "Record Selected Portion". Browser window only, no desktop chrome. Two takes max — pick the cleaner one.

- [ ] **Step 8.3: Submit before 7:30 PM**

Upload via the hackathon submission portal. **Do not cut it close to 7:45.** If you hit a snag, you want 15 minutes of buffer, not 0.

---

## Time Budget Recap

| Wall clock | Person A | Person B | Person C |
|------------|----------|----------|----------|
| 0:00-0:15 | Pre-flight + hero scenario lock (all three) | | |
| 0:15-1:00 | Tasks 1, 3, 4 | Task 5 (waits on Task 1 commit) | Task 2 |
| 1:00-1:30 | Help integration | Task 6 | Demo script draft |
| 1:30-1:45 | Task 7 polish | Task 7 polish | Hero walkthrough rehearsal |
| 1:45-2:00 | Buffer / fix | Buffer / fix | Task 8 record + submit |

## Out of Scope (Resist Adding)

- **Live scraping at chat time.** Apify runs are 10-60s — fine for a one-time data load, fatal for a 60-second demo recording. Cache to JSON; the demo can mention "we can refresh anytime" without depending on it.
- User accounts, cart, checkout. Not a shopping experience — a recommendation conversation.
- Image generation or stock photos. Real Wayfair CDN URLs only.
- Voice input. Demo is text.
- A second agent. Chat agent only — researchAgent is untouched.
- Tests. We accepted no test framework as a deviation; verification is manual at each step.
- Cloudflare Workers deployment. Local `pnpm dev` for demo; push to Vercel only if time permits after submission.
- Trying multiple Apify actors back-to-back if the first fails. Hand-curation fallback is faster and more reliable past the 15-minute cap.

---

## Self-Review Notes

- Every spec requirement (clarify → search → recommend, fake catalog, product cards, hero demo, 2-hour 3-person split) maps to a task.
- No "TBD" placeholders — code blocks are concrete and copy-pasteable.
- Type names (`Product`, `Review`, `ProductCategory`, `ProductStyle`) are consistent across Tasks 1, 5, 6.
- Tool names (`searchProducts`, `getProductDetails`, `getReviews`) match between Tasks 1, 3, 4, and 6.
- Image hostname (`images.unsplash.com`) matches between Task 2 (catalog URLs) and Task 5 (next.config.ts allowlist).
- Acknowledged deviation: manual verification instead of unit tests, justified by the 2-hour clock and absent test framework.
- **Apify is a dependency-with-fallback.** Plan accounts for actor flakiness or bad output by hard-capping at 15 min and switching to hand-curated real listings (same schema, same code path). The agent's behavior is decoupled from the data source.
- Image hostnames in `next.config.ts` (Task 5) must match what `lib/data/catalog.json` (Task 2) actually contains. Step 5.1 includes a grep verification step to catch mismatches.
