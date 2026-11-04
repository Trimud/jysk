import type { Kind, X } from "@/lib/products";

/**
 * Corrections to the rows built from IKEA's listings (src/data/ikea-rows.ts), one product at a time, found by reading
 * each product's assembly manual beside its IKEA page (the page measurements in scripts/ikea/measures.json). A mistake
 * one rule explains for many products (corner sofas measured leg by leg, bed frames measured from the mattress) is fixed
 * where the rows are read, in scripts/ikea/classify.ts; these are the ones no rule explains. src/lib/catalog.ts applies
 * them as it reads the rows, so a rebuild of the rows keeps them. Hand made rows (ROWS in src/lib/products.ts, CATALOG
 * in src/lib/catalog.ts) are corrected where they are written.
 *
 * size is [w, h, d] in cm, as the kind draws it; x is merged into the row's parameters (undefined takes one out);
 * variant is IKEA's name when the listing names another product than its article is.
 */
export interface Fix {
  size?: [w: number, h: number, d: number];
  kind?: Kind;
  x?: Partial<Record<keyof X, X[keyof X] | undefined>>;
  variant?: string;
}

export const FIXES: Record<string, Fix> = {};

/**
 * Guides that are the same product as another guide: their link opens that one, and they are not listed. A hand made
 * guide IKEA's listings now draw under their own name, or a second hand made guide for one.
 */
export const SAME: Record<string, string> = {
  // JYSK stopped the dark oak colour; warm oak is the same table
  "coffee-table-spodsbjerg-d67-dark-oak-colour": "coffee-table-spodsbjerg-d67-warm-oak-colour",
};
