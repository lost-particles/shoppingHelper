"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface ProductData {
  id: string;
  name: string;
  price: number;
  rating: number;
  reviewCount: number;
  imageUrl: string;
  description: string;
  category: string;
  url?: string;
}

interface ShortlistEntry {
  product: ProductData;
  query: string;
  savedAt: string;
}

const SHORTLIST_KEY = "wayfair-shortlist";

function loadShortlist(): ShortlistEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SHORTLIST_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function removeFromShortlist(productId: string) {
  const list = loadShortlist().filter((e) => e.product.id !== productId);
  localStorage.setItem(SHORTLIST_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("shortlist-updated"));
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`text-xs ${i < full ? "text-amber-400" : i === full && half ? "text-amber-400/60" : "text-zinc-600"}`}>
          ★
        </span>
      ))}
      <span className="ml-1 text-xs text-zinc-400">{rating.toFixed(1)}</span>
    </span>
  );
}

function ShortlistCard({ entry, onRemove }: { entry: ShortlistEntry; onRemove: () => void }) {
  const { product } = entry;
  const wayfairUrl = product.url ?? `https://www.wayfair.com/keyword.php?keyword=${encodeURIComponent(product.name)}`;

  return (
    <div className="flex gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-600">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.imageUrl}
        alt={product.name}
        className="h-28 w-28 flex-none rounded-lg object-cover"
      />
      <div className="flex flex-1 flex-col justify-between gap-2">
        <div>
          <p className="font-medium text-zinc-100 leading-snug">{product.name}</p>
          <p className="mt-0.5 text-xs text-zinc-500 capitalize">{product.category}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">${product.price.toFixed(2)}</span>
          <StarRating rating={product.rating} />
          {product.reviewCount > 0 && (
            <span className="text-xs text-zinc-500">({product.reviewCount.toLocaleString()} reviews)</span>
          )}
        </div>
        <div className="flex gap-2">
          <a
            href={wayfairUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-[#FF5C28] hover:text-[#FF5C28]"
          >
            View on Wayfair ↗
          </a>
          <button
            onClick={onRemove}
            className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-red-800 hover:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>
      <div className="hidden flex-none text-right sm:block">
        <p className="text-xs text-zinc-600">Saved from query</p>
        <p className="mt-1 max-w-[160px] text-xs italic text-zinc-500 line-clamp-2">"{entry.query}"</p>
        <p className="mt-1 text-xs text-zinc-700">
          {new Date(entry.savedAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default function ShortlistPage() {
  const [entries, setEntries] = useState<ShortlistEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const load = () => setEntries(loadShortlist());
    load();
    window.addEventListener("shortlist-updated", load);
    return () => window.removeEventListener("shortlist-updated", load);
  }, []);

  function handleRemove(productId: string) {
    removeFromShortlist(productId);
    setEntries(loadShortlist());
  }

  function handleClear() {
    localStorage.removeItem(SHORTLIST_KEY);
    window.dispatchEvent(new Event("shortlist-updated"));
    setEntries([]);
  }

  // Group by query
  const byQuery = entries.reduce<Record<string, ShortlistEntry[]>>((acc, entry) => {
    const key = entry.query;
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="flex min-h-full flex-col bg-black">
      <header className="border-b border-zinc-800 bg-black">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-zinc-400 hover:text-white transition"
            >
              ← Back to chat
            </Link>
            <span className="text-zinc-700">|</span>
            <h1 className="text-lg font-semibold text-white">My Shortlist</h1>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleClear}
              className="text-xs text-zinc-600 hover:text-red-400 transition"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        {!mounted ? null : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-4xl">♡</p>
            <p className="mt-4 text-lg font-medium text-zinc-300">No saved items yet</p>
            <p className="mt-2 text-sm text-zinc-500">
              Ask the concierge for recommendations and hit Save on anything you like.
            </p>
            <Link
              href="/"
              className="mt-6 rounded-xl bg-[#FF5C28] px-5 py-2.5 text-sm font-medium text-black hover:bg-[#ff7347]"
            >
              Start shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            <p className="text-sm text-zinc-500">
              {entries.length} item{entries.length !== 1 ? "s" : ""} saved
            </p>
            {Object.entries(byQuery).map(([query, items]) => (
              <section key={query}>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  From: <span className="text-zinc-400 normal-case font-normal">"{query}"</span>
                </p>
                <div className="space-y-3">
                  {items.map((entry) => (
                    <ShortlistCard
                      key={entry.product.id}
                      entry={entry}
                      onRemove={() => handleRemove(entry.product.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
