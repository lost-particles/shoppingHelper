# Plan B — Frontend: Product Cards and Chat UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render `searchProducts` tool output as a grid of product cards (image, name, price, rating, description) instead of a plain "Tool: Done" chip. Rebrand the chat UI header as a Wayfair shopping concierge. Configure Next.js to allow images from Wayfair and Unsplash CDNs.

**Architecture:** New `components/product-card.tsx` exports `ProductCard` and `ProductGrid` (Tailwind v4 + `next/image`). Modify `components/chat-app.tsx`'s `MessagePart` to detect `tool-searchProducts` output and render the grid inline in the conversation. Extend `next.config.ts`'s `images.remotePatterns` for both Unsplash (seed data) and Wayfair CDN hosts (Plan C's real data). Update `app/layout.tsx` page title and the in-page header copy.

**Tech Stack:** TypeScript · React 19 · Next.js 16 (`next/image`) · Tailwind v4 · Vercel AI SDK v6 (`useChat`, `UIMessage` parts)

---

## Prerequisites

- The **Kickoff plan** ([2026-05-26-shopping-agent-0-kickoff.md](2026-05-26-shopping-agent-0-kickoff.md)) has been committed to `main`. Your worktree branches from a state where `lib/data/types.ts` and seed JSON files exist.
- `pnpm install` has been run.
- You can run `pnpm dev` and load http://localhost:3000.

If any of the above is false, stop and run the Kickoff plan first.

---

## File Ownership

**You create / modify ONLY these files:**
- Create: `components/product-card.tsx`
- Modify: `components/chat-app.tsx`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`

**Do NOT touch:**
- `lib/data/types.ts` — shared contract (you import from it; do not modify)
- `lib/data/catalog.json` / `lib/data/reviews.json` — owned by Plan C
- `lib/tools/**` — owned by Plan A
- `lib/agents/**` — owned by Plan A
- `scripts/**` — owned by Plan C
- `lib/subconscious.ts`, `app/api/chat/route.ts` — work as-is

---

## Tasks

### Task B1: ProductCard component

**File:** `components/product-card.tsx` (new)

- [ ] **Step B1.1: Create the component**

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
          {product.styles[0] && (
            <>
              <span>·</span>
              <span className="capitalize">{product.styles[0]}</span>
            </>
          )}
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

- [ ] **Step B1.2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step B1.3: Commit**

```bash
git add components/product-card.tsx
git commit -m "feat(B): ProductCard and ProductGrid components"
```

---

### Task B2: Allow Wayfair and Unsplash hosts in Next.js

**File:** `next.config.ts` (modify)

- [ ] **Step B2.1: Replace the contents**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "secure.img1-fg.wfcdn.com" },
      { protocol: "https", hostname: "secure.img2-fg.wfcdn.com" },
      { protocol: "https", hostname: "assets.wfcdn.com" },
      { protocol: "https", hostname: "**.wfcdn.com" },
    ],
  },
};

export default nextConfig;
```

The Unsplash entry handles seed data; the wfcdn.com entries handle Plan C's real Wayfair scrape. If Plan C reports a different CDN hostname appears in the dump, add it here after their branch lands.

- [ ] **Step B2.2: Restart the dev server**

`next.config.ts` changes do not always hot-reload. Kill `pnpm dev` and restart.

- [ ] **Step B2.3: Commit**

```bash
git add next.config.ts
git commit -m "feat(B): allow Wayfair and Unsplash CDN images"
```

---

### Task B3: Render product cards in the chat stream

**File:** `components/chat-app.tsx` (modify)

- [ ] **Step B3.1: Add imports**

In `components/chat-app.tsx`, after the existing imports at the top of the file, add:

```typescript
import { ProductGrid } from "@/components/product-card";
import type { Product } from "@/lib/data/types";
```

- [ ] **Step B3.2: Replace the `tool-` branch of `MessagePart`**

In the same file find the block that starts with `if (part.type.startsWith("tool-"))` (around line 44 of the starter). Replace the entire `if (part.type.startsWith("tool-")) { ... }` block with:

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

Other tool calls (`getProductDetails`, `getReviews`) keep the small chip — only `searchProducts` gets the card grid.

- [ ] **Step B3.3: Update the empty-state suggestions**

In the same file find the empty-state `<ul>` (around line 184). Replace its contents with shopping prompts:

```typescript
              <ul className="mt-4 max-w-md space-y-2 text-sm">
                <li>"I need a reading chair for a small apartment, under $500"</li>
                <li>"Cozy reading nook, warm tones, around $800 total"</li>
                <li>"Is the Linen Slope Armchair good for cats?"</li>
                <li>"Compare two midcentury floor lamps for me"</li>
              </ul>
```

- [ ] **Step B3.4: Update the header copy**

Same file, find this block:

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

- [ ] **Step B3.5: Visual verification**

If Plan A's branch hasn't merged yet, you cannot trigger `tool-searchProducts` from the UI. Two verification paths:

**Path B3.5a — Plan A is merged or you can pull A's branch into your worktree:**

Run `pnpm dev`, open http://localhost:3000, send:

> `Find me an armchair under $500.`

Expected: a "Found N picks" pill, then a 1-2-3 column grid of cards with images, names, prices, ratings.

**Path B3.5b — Plan A is not yet available:**

You cannot trigger the tool path. Verify what you can:
- The header copy is updated ("Wayfair Concierge", "Shop by Conversation")
- The empty-state suggestions are the new shopping prompts
- The dev server has no compile errors
- TypeScript is clean: `pnpm tsc --noEmit 2>&1 | head -20`

That's sufficient for Plan B. Card rendering will be verifiable post-merge with A.

- [ ] **Step B3.6: Commit**

```bash
git add components/chat-app.tsx
git commit -m "feat(B): render searchProducts as product card grid; rebrand header"
```

---

### Task B4: Page metadata

**File:** `app/layout.tsx` (modify)

- [ ] **Step B4.1: Update metadata**

Find the existing `metadata` export. Replace with:

```typescript
export const metadata: Metadata = {
  title: "Wayfair Concierge",
  description: "Shop furniture by conversation.",
};
```

If the surrounding `Metadata` import already exists, leave it. If not, add `import type { Metadata } from "next";` at the top.

- [ ] **Step B4.2: Verify the browser tab title updates**

Hard-refresh the browser. The tab should say "Wayfair Concierge".

- [ ] **Step B4.3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(B): page metadata for Wayfair Concierge"
```

---

## Final Verification

- [ ] **Step B-Final.1: TypeScript clean**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step B-Final.2: Lint clean**

```bash
pnpm lint 2>&1 | head -30
```

Expected: no errors. (Warnings are OK if the starter has any baseline.)

- [ ] **Step B-Final.3: Push the branch**

```bash
git push origin <your-branch-name>
```

Ready for merge with Plans A and C. No expected conflicts — your files are disjoint from theirs.

---

## Return Summary

When done, report:
- Which files you changed
- Whether you could verify card rendering (depends on whether Plan A merged first)
- Any deviations from the plan
- Branch name to merge from

## Out of Scope for Plan B

- Touching tool / agent code (Plan A owns)
- Touching catalog / review data (Plan C owns)
- New UI screens beyond what's in `chat-app.tsx`
- Voice input
- Animations beyond Tailwind's `transition` and built-in pulse
- Themes / dark mode toggle
