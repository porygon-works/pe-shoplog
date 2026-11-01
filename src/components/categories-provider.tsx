"use client";

import { createContext, useContext } from "react";
import type { Categories } from "@/lib/category-utils";

const CategoriesContext = createContext<Categories | null>(null);

export function useCategories(): Categories {
  const ctx = useContext(CategoriesContext);
  if (!ctx) throw new Error("useCategories は CategoriesProvider の内側で使ってください");
  return ctx;
}

export function CategoriesProvider({ categories, children }: { categories: Categories; children: React.ReactNode }) {
  return <CategoriesContext.Provider value={categories}>{children}</CategoriesContext.Provider>;
}
