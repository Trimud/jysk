import type { ProductSpec } from "./types";
import { ROWS, specFor, type Kind, type X } from "./products";
import { fold } from "./fold";
import { decodeRows, type JyskRow } from "./jysk";
import { JYSK_ROWS } from "@/data/jysk-rows";
import { FIXES, SAME } from "@/data/fixes";

type Entry = Omit<ProductSpec, "source" | "slug" | "variants" | "siblings"> & {
  slug: string;
  family: string;
  kind?: Kind;
  keywords?: string[];
  featured?: boolean;
  checked?: boolean;
  /** drawn later than the family's other pieces under JYSK's own name for it: comes after them in search */
  late?: boolean;
  /** sold in the US and not in the UK: comes after the family's UK pieces, even when the query has its US words */
  us?: boolean;
  /** JYSK's listing's variant, when src/data/fixes.ts gives the product its own name (slugs.json knows it by this one) */
  listed?: string;
  /** what the browse filters read (src/lib/jysk.ts) */
  facts?: Record<string, string[]>;
  /** JYSK's breadcrumb for it, room first and product type last: the browse filters go by it */
  path?: string[];
};

/** Hand-checked starting points for popular flat packs. Dimensions in cm. */
// ponytail: emptied in Phase 0; the Phase 2 pilot adds hand-checked JYSK entries here
export const CATALOG: Entry[] = [];

/** The slug a name and variant give before any "-2" suffix. Existing slugs depend on this staying the same. */
export function baseSlug(name: string, variant: string) {
  return (fold(name) + " " + fold(variant).replace(/\b(cm|with|of)\b/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ /g, "-")
    .slice(0, 48)
    .replace(/-+$/, "");
}

function rowSlug(name: string, variant: string, used: Set<string>) {
  const base = baseSlug(name, variant);
  let slug = base;
  let n = 2;
  while (used.has(slug)) slug = `${base}-${n++}`;
  used.add(slug);
  return slug;
}

const used = new Set(CATALOG.map((c) => c.slug));
const GENERATED: Entry[] = ROWS.map(([name, kind, variant, w, h, d, x, kw, pinned]) => ({
  ...specFor(kind, name, variant, w, h, d, x),
  slug: pinned ? (used.add(pinned), pinned) : rowSlug(name, variant, used),
  family: fold(name),
  kind,
  keywords: kw ? kw.split(" ") : undefined,
}));

/** The hand made part of the catalog. Its slugs never change: people have progress saved under them. */
/** What kind of furniture each hand-checked entry is, for grouping (its archetype params stay as written). */
const CATEGORY_KIND: Record<string, Kind> = {
  "Shelving unit": "cube", Bookcase: "bookcase", "Chest of drawers": "chest", Nightstand: "nightstand", "Drawer unit": "chest", "Bed frame": "bed",
  "Side table": "side", "Coffee table": "coffee", Desk: "desk", "Dining table": "dining", Wardrobe: "wardrobe", "Wardrobe frame": "wardrobe",
  Cabinet: "cabinet", Stool: "stool", Chair: "chair", "TV bench": "tv",
};

/** Hand made entries, apart from those that are the same product as another guide (src/data/fixes.ts SAME). */
export const BASE: Entry[] = [...CATALOG.map((c) => ({ ...c, checked: true, kind: CATEGORY_KIND[c.category] })), ...GENERATED].filter((e) => !SAME[e.slug]);

/** A catalog row with its correction from src/data/fixes.ts, when it has one. */
function fixed(r: JyskRow, slug: string): JyskRow & { listed?: string } {
  const f = FIXES[slug];
  if (!f) return r;
  const x = { ...r.x, ...f.x } as X;
  for (const k of Object.keys(x) as (keyof X)[]) if (x[k] === undefined) delete x[k];
  const [w, h, d] = f.size ?? [r.w, r.h, r.d];
  return { ...r, kind: f.kind ?? r.kind, variant: f.variant ?? r.variant, w, h, d, x, ...(f.variant ? { listed: r.variant } : {}) };
}

/** Rows generated from JYSK's product pages (scripts/jysk/build.ts). Hand made entries always win. */
const JYSK: Entry[] = [];
for (const row of decodeRows(JYSK_ROWS)) {
  const slug = row.slug ?? baseSlug(row.name, row.variant);
  if (used.has(slug)) continue;
  used.add(slug);
  if (SAME[slug]) continue;
  const r = fixed(row, slug);
  JYSK.push({ ...specFor(r.kind, r.name, r.variant, r.w, r.h, r.d, r.x), slug, manual: r.manual, colours: r.colours, family: fold(r.name), kind: r.kind, keywords: [...(r.keywords ?? []), ...(r.path?.length ? [r.path[r.path.length - 1]] : []), ...(r.colours ?? []).map((c) => c.sku)], ...(row.x.us ? { us: true } : row.x.cat ? { late: true } : {}), ...(r.listed ? { listed: r.listed } : {}), ...(r.path ? { path: r.path } : {}), ...(r.facts ? { facts: r.facts } : {}) });
}

/** Every product we can draw offline: hand-checked entries first, then the wider index, then JYSK's catalog. */
export const PRODUCTS: Entry[] = [...BASE, ...JYSK];

const BY_SLUG = new Map(PRODUCTS.map((e) => [e.slug, e]));
/** Article numbers (one per colour) to the guide that covers them. */
const BY_ARTICLE = new Map(PRODUCTS.flatMap((e) => (e.colours ?? []).map((c) => [c.sku, e.slug] as const)));

/** The guide for a JYSK article number, or null. */
export function articleSlug(no: string): string | null {
  return BY_ARTICLE.get(no) ?? null;
}
const BY_FAMILY = new Map<string, Entry[]>();
for (const e of PRODUCTS) {
  const list = BY_FAMILY.get(e.family);
  if (list) list.push(e);
  else BY_FAMILY.set(e.family, [e]);
}

/** The guide a slug opens: its own, or the one it is the same product as (src/data/fixes.ts SAME). */
export function catalogEntry(slug: string): Entry | null {
  return BY_SLUG.get(slug) ?? BY_SLUG.get(SAME[slug] ?? "") ?? null;
}

export function catalogSpec(slug: string): ProductSpec | null {
  const e = catalogEntry(slug);
  if (!e) return null;
  return toSpec(e);
}

/** One way of naming sizes per family: grids as columns × rows, shelves and cabinets as width × height (and depth when two share those). */
function sizeLabel(x: Entry, same: Entry[]) {
  const head = x.variant.split(",")[0];
  if (x.shelf?.style === "grid" && x.shelf.cols && x.shelf.rows) return `${head}, ${x.shelf.cols} × ${x.shelf.rows}`;
  // a corner cabinet or wardrobe goes by JYSK's own measure, leg by leg
  if (x.cabinet?.corner || x.kind === "cornerrobe") return x.variant;
  if ((x.archetype === "shelf" || x.archetype === "cabinet") && /\d+ × \d+/.test(x.variant)) {
    const twin = same.some((o) => o !== x && o.size.w === x.size.w && o.size.h === x.size.h);
    return `${head}, ${x.size.w} × ${x.size.h} cm${twin ? `, ${x.size.d} deep` : ""}`;
  }
  return x.variant;
}

export function toSpec(e: Entry): ProductSpec {
  const { family, kind, keywords, featured, checked, late, us, listed, path, facts, ...rest } = e;
  void path;
  void facts;
  void listed;
  void late;
  void us;
  void kind;
  void keywords;
  void featured;
  void checked;
  const kin = BY_FAMILY.get(family) ?? [e];
  const same = kin.filter((x) => x.category === e.category);
  // smallest first, and a cube grid always reads as columns × rows, like the labels on the box
  const variants = [...same]
    .sort((a, b) => a.size.w * a.size.h - b.size.w * b.size.h || a.size.d - b.size.d)
    .map((x) => ({ label: sizeLabel(x, same), slug: x.slug }))
    .filter((v, i, all) => all.findIndex((o) => o.label === v.label) === i || v.slug === e.slug);
  const seen = new Set<string>([e.category]);
  const siblings: { label: string; slug: string }[] = [];
  for (const x of kin) {
    if (seen.has(x.category)) continue;
    seen.add(x.category);
    siblings.push({ label: x.category, slug: x.slug });
  }
  return { ...rest, source: "catalog", variants: variants.length > 1 ? variants : undefined, siblings: siblings.length ? siblings : undefined };
}

export type CatalogEntry = Entry;
