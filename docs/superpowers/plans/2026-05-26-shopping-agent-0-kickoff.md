# Kickoff: Shared Scaffolding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. This is a small, sequential plan — run end-to-end in a single session, commit, and push before the three parallel agents fan out.

**Goal:** Establish the shared contract (`Product`/`Review` types) and 5 seed products on `main` so the three parallel agent plans (A-backend, B-frontend, C-data) can work independently without merge conflicts.

**Architecture:** Create the `lib/data/types.ts` type definitions that all three downstream plans import. Seed `lib/data/catalog.json` and `lib/data/reviews.json` with 5 representative products so A and B can verify their work before C overwrites with the real Wayfair Apify scrape.

**Tech Stack:** TypeScript · JSON · pnpm

**Run by:** A single agent or operator. Commit to `main`. Three downstream agents then create worktrees from this state.

---

## Files

**Create:**
- `lib/data/types.ts` — `Product`, `Review`, `ProductCategory`, `ProductStyle` types
- `lib/data/catalog.json` — 5 seed products (overwritten by Plan C later)
- `lib/data/reviews.json` — 10 seed reviews (overwritten by Plan C later)
- `.env.local` — `SUBCONSCIOUS_API_KEY` and `APIFY_TOKEN` (gitignored)

**Do NOT touch:**
- Anything else. The three parallel plans own everything else.

---

## Tasks

- [ ] **Step 1: Install dependencies**

```bash
pnpm install
```

Expected: completes without errors, `node_modules/` appears.

- [ ] **Step 2: Sign up for API keys**

- **Subconscious:** https://www.subconscious.dev/platform → copy `sky_...` key.
- **Apify** (only needed for Plan C, but set now): https://apify.com → console → Settings → Integrations → copy token.

- [ ] **Step 3: Create `.env.local`**

```bash
echo "SUBCONSCIOUS_API_KEY=sky_your_actual_key_here" > .env.local
echo "APIFY_TOKEN=apify_api_your_actual_token_here" >> .env.local
```

Confirm `.env.local` is in `.gitignore` (it should be, default Next.js).

- [ ] **Step 4: Create the type contract**

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

**This file is the contract.** Plans A, B, and C all import from `@/lib/data/types`. Do not change field names or types after kickoff — that would force coordinated edits across all three plans.

- [ ] **Step 5: Seed `lib/data/catalog.json`**

Create with 5 representative products. Image URLs use Unsplash so they actually render during local verification — Plan B's `next.config.ts` will allow both `images.unsplash.com` and `**.wfcdn.com` so Plan C's real Wayfair URLs work too.

```json
[
  {
    "id": "seed-chair-001",
    "name": "Linen Slope Armchair (seed)",
    "category": "chair",
    "price": 489,
    "dimensions": { "width": 32, "depth": 34, "height": 36, "unit": "in" },
    "materials": ["linen", "solid oak", "foam cushion"],
    "colors": ["oatmeal", "warm beige"],
    "styles": ["scandi", "modern"],
    "imageUrl": "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=800&q=80",
    "description": "A low-slung armchair with a curved oak frame and soft linen upholstery. Reads warm but understated.",
    "rating": 4.6,
    "reviewCount": 142
  },
  {
    "id": "seed-chair-002",
    "name": "Velvet Reading Chair (seed)",
    "category": "chair",
    "price": 629,
    "dimensions": { "width": 30, "depth": 36, "height": 39, "unit": "in" },
    "materials": ["velvet", "hardwood frame"],
    "colors": ["rust", "burnt sienna"],
    "styles": ["midcentury", "boho"],
    "imageUrl": "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
    "description": "A high-backed armchair in deep rust velvet. The kind of chair you sink into for three hours and forget the time.",
    "rating": 4.8,
    "reviewCount": 89
  },
  {
    "id": "seed-lamp-001",
    "name": "Brass Arc Floor Lamp (seed)",
    "category": "lamp",
    "price": 219,
    "dimensions": { "width": 18, "depth": 60, "height": 70, "unit": "in" },
    "materials": ["brass", "marble base", "linen shade"],
    "colors": ["brass", "cream"],
    "styles": ["midcentury", "modern"],
    "imageUrl": "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=800&q=80",
    "description": "Curves over a chair or sofa to cast warm reading light without taking up floor real estate.",
    "rating": 4.5,
    "reviewCount": 211
  },
  {
    "id": "seed-rug-001",
    "name": "Persian-Inspired Wool Rug 5x8 (seed)",
    "category": "rug",
    "price": 349,
    "dimensions": { "width": 60, "depth": 96, "height": 1, "unit": "in" },
    "materials": ["wool", "cotton backing"],
    "colors": ["terracotta", "navy", "cream"],
    "styles": ["boho", "traditional"],
    "imageUrl": "https://images.unsplash.com/photo-1600166898405-da9535204843?w=800&q=80",
    "description": "Hand-loomed wool with a faded terracotta field. Anchors a small room without making it feel busier.",
    "rating": 4.7,
    "reviewCount": 304
  },
  {
    "id": "seed-shelf-001",
    "name": "Walnut Ladder Bookshelf (seed)",
    "category": "shelf",
    "price": 279,
    "dimensions": { "width": 24, "depth": 14, "height": 72, "unit": "in" },
    "materials": ["walnut veneer", "steel"],
    "colors": ["walnut"],
    "styles": ["midcentury", "industrial"],
    "imageUrl": "https://images.unsplash.com/photo-1594620302200-9a762244a156?w=800&q=80",
    "description": "Narrow leaning bookshelf — five tiers, takes up two square feet of floor.",
    "rating": 4.4,
    "reviewCount": 167
  }
]
```

- [ ] **Step 6: Seed `lib/data/reviews.json`**

Create with 2 reviews per seed product (10 total). Mix opinions — at least one review per product mentions a real tradeoff.

```json
[
  {
    "id": "r-seed-chair-001-a",
    "productId": "seed-chair-001",
    "rating": 5,
    "title": "Disappears into our living room",
    "body": "We have a small Cambridge apartment and this chair is the rare piece that doesn't make a room feel smaller. The oatmeal linen reads warm next to our wood floors. Comfortable for an hour of reading; firmer than a club chair.",
    "ownerMonths": 8
  },
  {
    "id": "r-seed-chair-001-b",
    "productId": "seed-chair-001",
    "rating": 4,
    "title": "Great looking, less great for napping",
    "body": "Beautiful chair, the linen has held up well to two cats. Honest note: the cushion is on the firm side. For reading or working from a tablet, it's perfect.",
    "ownerMonths": 14
  },
  {
    "id": "r-seed-chair-002-a",
    "productId": "seed-chair-002",
    "rating": 5,
    "title": "Worth every penny",
    "body": "Deeper than it looks in photos. I'm 6'1\" and can fully recline against the back. Velvet has shown no wear after a year.",
    "ownerMonths": 12
  },
  {
    "id": "r-seed-chair-002-b",
    "productId": "seed-chair-002",
    "rating": 4,
    "title": "Color is more orange than photos suggest",
    "body": "Beautiful chair but the 'rust' is more of a burnt orange in person. Worked great with our navy walls; would have clashed with red tones. Check it in real light first.",
    "ownerMonths": 6
  },
  {
    "id": "r-seed-lamp-001-a",
    "productId": "seed-lamp-001",
    "rating": 5,
    "title": "Solid build, beautiful light",
    "body": "Marble base is genuinely heavy — won't tip over on a thick rug. The arc reaches further than I expected; I have it next to a sofa lighting two reading spots.",
    "ownerMonths": 9
  },
  {
    "id": "r-seed-lamp-001-b",
    "productId": "seed-lamp-001",
    "rating": 3,
    "title": "Bulb not included is the right call but...",
    "body": "Lamp itself is great. They specify a max 60W bulb and I'd believe it — runs warm at the top. Use LEDs.",
    "ownerMonths": 3
  },
  {
    "id": "r-seed-rug-001-a",
    "productId": "seed-rug-001",
    "rating": 5,
    "title": "Texture and color are spot-on",
    "body": "The terracotta is muted, not loud. Pile is short which is great with dining chairs sliding across. No shedding after a month.",
    "ownerMonths": 1
  },
  {
    "id": "r-seed-rug-001-b",
    "productId": "seed-rug-001",
    "rating": 4,
    "title": "Smaller than expected",
    "body": "5x8 is the listed size but felt smaller in our 12x15 living room. Anchors a coffee table fine, won't fit under a sofa.",
    "ownerMonths": 4
  },
  {
    "id": "r-seed-shelf-001-a",
    "productId": "seed-shelf-001",
    "rating": 5,
    "title": "Perfect for a studio",
    "body": "Easy assembly, sturdy once anchored to the wall. Holds about 60 paperbacks across the five tiers.",
    "ownerMonths": 7
  },
  {
    "id": "r-seed-shelf-001-b",
    "productId": "seed-shelf-001",
    "rating": 3,
    "title": "Wall anchor is non-optional",
    "body": "It leans, but it leans too easily — definitely anchor it. The included hardware is fine but you may want better drywall anchors depending on your wall.",
    "ownerMonths": 11
  }
]
```

- [ ] **Step 7: Verify TypeScript happy**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors. (None of the seed files are imported yet — this just confirms `types.ts` parses.)

- [ ] **Step 8: Verify dev server starts**

```bash
pnpm dev
```

Open http://localhost:3000, send "hello" in Chat mode, confirm a reply streams back. Kill the dev server with Ctrl-C.

- [ ] **Step 9: Lock the hero demo scenario**

Add a `HERO_SCENARIO.md` (or paste into a shared team doc — whichever you prefer). Recommended scenario:

> "Setting up a reading nook in a small Boston apartment, budget around $800. I want it cozy but not cluttered — warm tones, no minimalist white box. What should I get?"

All three downstream plans assume this is the demo path.

- [ ] **Step 10: Commit and push to main**

```bash
git add lib/data/types.ts lib/data/catalog.json lib/data/reviews.json
git commit -m "feat: kickoff scaffolding — shared types and seed catalog"
git push origin main
```

- [ ] **Step 11: Announce kickoff complete**

Tell the team / dispatcher: "Kickoff is on `main`. Cut three worktrees from here." Plans A, B, C are now safe to start in parallel.

---

## Notes for Downstream Agents

- The seed data is intentionally labeled "(seed)" in product names so any agent verifying with it knows it's not the real catalog.
- Plan C will overwrite `lib/data/catalog.json` and `lib/data/reviews.json`. If your worktree merges with Plan C's branch first, expect those files to look different.
- The `Product` and `Review` types in `lib/data/types.ts` are the contract. Do not modify in your worktree — flag any change request back to the dispatcher so all three plans can adjust together.
