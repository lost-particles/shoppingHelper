"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/data/types";

const SHORTLIST_KEY = "wayfair-shortlist";

interface ShortlistEntry {
  product: Product;
  query: string;
  savedAt: string;
}

function loadShortlist(): ShortlistEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]"); }
  catch { return []; }
}

function toggleShortlist(product: Product, query: string) {
  const list = loadShortlist();
  const exists = list.some((e) => e.product.id === product.id);
  const next = exists
    ? list.filter((e) => e.product.id !== product.id)
    : [...list, { product, query, savedAt: new Date().toISOString() }];
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("shortlist-updated"));
}

export function ProductCard({ product, query = "" }: { product: Product; query?: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(loadShortlist().some((e) => e.product.id === product.id));
    sync();
    window.addEventListener("shortlist-updated", sync);
    return () => window.removeEventListener("shortlist-updated", sync);
  }, [product.id]);

  const wayfairUrl = product.url ??
    `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(product.name)}`;

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
          <h3 className="text-sm font-medium text-white leading-snug">{product.name}</h3>
          <span className="shrink-0 text-sm font-semibold text-[#FF5C28]">
            ${product.price.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span>⭐ {product.rating.toFixed(1)}</span>
          <span>·</span>
          <span>{product.reviewCount.toLocaleString()} reviews</span>
          {product.styles[0] && (
            <>
              <span>·</span>
              <span className="capitalize">{product.styles[0]}</span>
            </>
          )}
        </div>
        {product.description && (
          <p className="line-clamp-2 text-xs text-zinc-400">{product.description}</p>
        )}
        <div className="mt-auto flex gap-1.5 pt-1">
          <a
            href={wayfairUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-lg border border-zinc-700 py-1.5 text-center text-xs font-medium text-zinc-300 transition hover:border-[#FF5C28] hover:text-[#FF5C28]"
          >
            View on Wayfair ↗
          </a>
          <button
            onClick={() => toggleShortlist(product, query)}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              saved
                ? "border-[#FF5C28] bg-[rgb(255_92_40/0.15)] text-[#FF5C28]"
                : "border-zinc-700 text-zinc-400 hover:border-[#FF5C28] hover:text-[#FF5C28]"
            }`}
            title={saved ? "Remove from shortlist" : "Save to shortlist"}
          >
            {saved ? "♥" : "♡"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProductGrid({ products, query = "" }: { products: Product[]; query?: string }) {
  if (!products.length) {
    return (
      <p className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
        No matches in the catalog.
      </p>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} query={query} />
      ))}
    </div>
  );
}
