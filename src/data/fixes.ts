import type { Kind, X } from "@/lib/products";

/**
 * Corrections to the rows built from JYSK's listings (src/data/jysk-rows.ts), one product at a time, found by reading
 * each product's assembly manual beside its JYSK page (cached in scripts/jysk/cache/). A mistake one rule explains for
 * many products (corner sofas measured leg by leg, bed frames measured from the mattress) is fixed where the rows are
 * read, in classify() in scripts/jysk/build.ts; these are the ones no rule explains. src/lib/catalog.ts applies
 * them as it reads the rows, so a rebuild of the rows keeps them. Hand made rows (ROWS in src/lib/products.ts, CATALOG
 * in src/lib/catalog.ts) are corrected where they are written.
 *
 * size is [w, h, d] in cm, as the kind draws it; x is merged into the row's parameters (undefined takes one out);
 * variant is JYSK's name when the listing names another product than its article is; manual is the assembly manual's
 * link when the product's own page has none and another JYSK site has it (checked by name, drawing and size).
 */
export interface Fix {
  size?: [w: number, h: number, d: number];
  kind?: Kind;
  x?: Partial<Record<keyof X, X[keyof X] | undefined>>;
  variant?: string;
  manual?: string;
}

export const FIXES: Record<string, Fix> = {
  // jysk.co.uk's page links no manual; jysk.ca has it (HUNDESTED armchair 718-257-1040)
  "armchair-hundested-white-teddy-natural-oak-colour": { manual: "https://www.jysk.ca/media/upfiles/new_instructions/ai_7018_HUNDESTED%20Armchair%20718-257-1040_20260107.pdf" },
  // the white one's page on jysk.co.uk links it; its cover lists this product's articles 3670444, 3618924, 3618927
  "bedside-table-limfjorden-2-draw-wild-natural-oak-colour": { manual: "https://cdn4.jysk.com/ttr/ai/5425560" },
};

/**
 * Guides that are the same product as another guide: their link opens that one, and they are not listed. A hand made
 * guide JYSK's listings now draw under their own name, or a second hand made guide for one.
 */
export const SAME: Record<string, string> = {
  // JYSK stopped the dark oak colour; warm oak is the same table
  "coffee-table-spodsbjerg-d67-dark-oak-colour": "coffee-table-spodsbjerg-d67-warm-oak-colour",
};
