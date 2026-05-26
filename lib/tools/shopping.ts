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
