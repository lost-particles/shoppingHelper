# Plan A — Backend: Shopping Tools and Agent Prompt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the three shopping tools (`searchProducts`, `getProductDetails`, `getReviews`) backed by a static JSON catalog, wire them into the chat agent, and rewrite the agent's instructions to drive a clarify → search → recommend conversational flow.

**Architecture:** New file `lib/tools/shopping.ts` defines three `tool()` definitions with Zod schemas that read from `lib/data/catalog.json` and `lib/data/reviews.json`. `lib/tools/index.ts` swaps the demo tools (`getWeather`, `calculate`) out of `chatTools` and uses `shoppingTools`. `lib/agents/index.ts` replaces `CHAT_INSTRUCTIONS` with a Wayfair-concierge persona that asks at most two clarifying questions before recommending 2-3 products with reasoning grounded in reviews.

**Tech Stack:** TypeScript · Vercel AI SDK v6 (`tool`, `ToolLoopAgent`) · Zod · Subconscious `tim-qwen3.6-27b`

---

## Prerequisites

- The **Kickoff plan** ([2026-05-26-shopping-agent-0-kickoff.md](2026-05-26-shopping-agent-0-kickoff.md)) has been committed to `main`. Your worktree branches from a state where `lib/data/types.ts`, `lib/data/catalog.json` (5 seed products), and `lib/data/reviews.json` (10 seed reviews) already exist.
- `SUBCONSCIOUS_API_KEY` is in `.env.local`.
- `pnpm install` has been run.

If any of the above is false, stop and run the Kickoff plan first.

---

## File Ownership

**You create / modify ONLY these files:**
- Create: `lib/tools/shopping.ts`
- Modify: `lib/tools/index.ts`
- Modify: `lib/agents/index.ts`

**Do NOT touch:**
- `lib/data/types.ts` — shared contract from kickoff
- `lib/data/catalog.json` / `lib/data/reviews.json` — owned by Plan C
- `components/**` — owned by Plan B
- `next.config.ts`, `app/layout.tsx` — owned by Plan B
- `scripts/**` — owned by Plan C
- `lib/subconscious.ts` — works as-is
- `app/api/chat/route.ts` — works as-is
- `lib/tools/mcp-tools.ts` — out of scope for chat mode
- The `researchAgent` definition in `lib/agents/index.ts` — leave it alone

---

## Tasks

### Task A1: Create the shopping tools file

**File:** `lib/tools/shopping.ts` (new)

- [ ] **Step A1.1: Create the file**

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
    "Search the Wayfair furniture catalog. Use natural language for `query` (e.g. 'cozy reading chair warm tones'). Apply filters when the user specifies a budget, room, or category. Returns up to `limit` ranked matches.",
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

- [ ] **Step A1.2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit 2>&1 | head -20
```

Expected: no errors. (The seed catalog/reviews JSON files from kickoff give shopping.ts something to import.)

- [ ] **Step A1.3: Commit**

```bash
git add lib/tools/shopping.ts
git commit -m "feat(A): add shopping tools with Zod schemas"
```

---

### Task A2: Wire shopping tools into the chat agent

**File:** `lib/tools/index.ts` (modify)

- [ ] **Step A2.1: Replace `chatTools` export**

Edit `lib/tools/index.ts`. At the bottom of the file find:

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

Leave `agentTools` alone — research mode keeps the demo tools.

- [ ] **Step A2.2: Verify dev server hot-reloads cleanly**

In a separate terminal:

```bash
pnpm dev
```

Watch the output. Expected: no compile errors on hot-reload.

- [ ] **Step A2.3: Smoke-test the tool from the UI**

Open http://localhost:3000, Chat mode, send:

> `Find me an armchair under $500.`

Expected: agent calls `searchProducts`, the UI shows a "Tool: searchProducts / Done" chip (or a richer rendering once Plan B merges), reply text references one or both of the seed armchairs (`Linen Slope Armchair (seed)` or `Velvet Reading Chair (seed)`).

If the agent doesn't call the tool, double-check that `chatTools` is now `{ ...shoppingTools }` and not a merge of old + new.

- [ ] **Step A2.4: Commit**

```bash
git add lib/tools/index.ts
git commit -m "feat(A): wire shopping tools into chat agent"
```

---

### Task A3: Rewrite the chat agent's instructions

**File:** `lib/agents/index.ts` (modify)

- [ ] **Step A3.1: Replace `CHAT_INSTRUCTIONS`**

In `lib/agents/index.ts` find the existing `CHAT_INSTRUCTIONS` constant near the top. Replace it with:

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

Leave `AGENT_INSTRUCTIONS` (the research agent prompt) alone.

- [ ] **Step A3.2: Verify the agent uses the new persona**

In the running UI, hard-refresh and send the hero scenario:

> "Setting up a reading nook in a small Boston apartment, budget around $800. I want it cozy but not cluttered — warm tones, no minimalist white box. What should I get?"

Expected behavior: agent either asks ONE focused clarifying question OR goes straight to `searchProducts`. The reply explains *why* each pick fits a small, warm-toned reading nook (not generic praise). With only 5 seed products available, the same 2-3 will surface for most queries — that's fine, you're verifying behavior, not catalog breadth.

If the agent asks 3+ questions, or recommends without calling `searchProducts`, or gives generic praise — re-read the prompt and tighten it.

- [ ] **Step A3.3: Commit**

```bash
git add lib/agents/index.ts
git commit -m "feat(A): shopping concierge agent prompt"
```

---

## Final Verification

- [ ] **Step A-Final.1: End-to-end check with seed data**

In the UI, send the hero scenario from above. Confirm:
1. Agent calls `searchProducts` at least once.
2. Reply names specific seed products.
3. Reasoning is product-specific (mentions "warm tones", "small apartment", or other scenario phrases tied to the actual picks).
4. No errors in the dev console or terminal.

- [ ] **Step A-Final.2: Push the branch**

```bash
git push origin <your-branch-name>
```

Ready for merge with Plans B and C. No expected merge conflicts — your files (`lib/tools/shopping.ts`, `lib/tools/index.ts`, `lib/agents/index.ts`) are disjoint from B's and C's.

---

## Return Summary

When done, report:
- Which files you changed
- That the hero scenario produces a reasonable response with seed data
- Any deviations from the plan (e.g. you tweaked the prompt for better behavior — call it out)
- Branch name to merge from

## Out of Scope for Plan A

- Touching UI files (Plan B owns)
- Touching data files (Plan C owns)
- Expanding the research agent / MCP tools
- Adding tests (no test framework — deviation acknowledged in overview plan)
- Tuning the catalog content or images
