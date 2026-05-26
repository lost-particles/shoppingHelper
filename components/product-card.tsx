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
          <span>Rating {product.rating.toFixed(1)}</span>
          <span>.</span>
          <span>{product.reviewCount} reviews</span>
          {product.styles[0] && (
            <>
              <span>.</span>
              <span className="capitalize">{product.styles[0]}</span>
            </>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-zinc-400">
          {product.description}
        </p>
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
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
