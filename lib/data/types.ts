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
  url?: string;
}

export interface Review {
  id: string;
  productId: string;
  rating: number;
  title: string;
  body: string;
  ownerMonths: number;
}
