import type { CatalogEntry } from "./catalog";
import { fold } from "./fold";

/**
 * The browse filters within a category (the category itself is the address, src/lib/categories.ts). Colours are grouped
 * by their main word, so "Light oak" and "Wild natural oak" are both Oak. Every facet is a short id that sits in the
 * address (/bedroom/beds?colour=beige).
 */

export type Facet = { id: string; label: string; n: number };

export const idOf = (s: string) => fold(s).replace(/\s+/g, "-");

export const seriesOf = (e: CatalogEntry) => idOf(e.name);

/** Colour groups, most specific first: a colour name joins the first group one of its words names. */
const COLOURS: [id: string, label: string, hex: string, words: RegExp][] = [
  ["oak", "Oak", "#c4ab99", /\boak\b/],
  ["walnut", "Walnut", "#7a5a43", /\bwalnut\b/],
  ["pine", "Pine", "#e2c89c", /\bpine\b/],
  ["bamboo", "Bamboo", "#d8c08f", /\bbamboo\b/],
  ["natural", "Natural wood", "#c9a57d", /\b(natural|wood|ash|acacia|teak|eucalyptus|rattan|wicker|willow|hardwood)\b/],
  ["stone", "Stone and marble", "#d9d4cc", /\b(marble|travertine|stone|terrazzo)\b/],
  ["white", "White", "#ffffff", /\b(white|off white|ivory)\b/],
  ["black", "Black", "#2b2b2b", /\b(black|anthracite|charcoal)\b/],
  ["grey", "Grey", "#9a9a9a", /\b(grey|gray|concrete|silver|steel|chrome)\b/],
  ["beige", "Beige", "#e2dad1", /\b(beige|sand|cream|taupe|linen)\b/],
  ["brown", "Brown", "#7b5a43", /\b(brown|cognac|chestnut|mocca|mocha|dark)\b/],
  ["green", "Green", "#7d8f69", /\b(green|olive|sage|khaki)\b/],
  ["blue", "Blue", "#5677a0", /\b(blue|navy|petrol)\b/],
  ["pink", "Pink", "#e1aeb0", /\b(pink|rose|dusty rose)\b/],
  ["purple", "Purple", "#6e4a63", /\b(purple|eggplant|plum|grape|lilac)\b/],
  ["yellow", "Yellow", "#e2c044", /\b(yellow|mustard|ochre)\b/],
  ["red", "Red", "#a84434", /\b(red|terracotta|rust)\b/],
  ["gold", "Gold and brass", "#c5a04d", /\b(gold|brass|copper)\b/],
];
export const COLOUR_HEX = Object.fromEntries(COLOURS.map(([id, , hex]) => [id, hex]));

/** The colour groups a product comes in, one per colour it's sold in (two-tone colours count by their first tone). */
export function coloursOf(e: CatalogEntry): string[] {
  const out = new Set<string>();
  for (const c of e.colours ?? []) {
    const first = fold(c.name.split("+")[0]);
    const hit = COLOURS.find(([, , , re]) => re.test(first));
    if (hit) out.add(hit[0]);
  }
  return [...out];
}

export type Sort = "name" | "quick" | "easy" | "small";
export const SORTS: { id: Sort; label: string }[] = [
  { id: "name", label: "Name A to Z" },
  { id: "quick", label: "Quickest to build" },
  { id: "easy", label: "Easiest first" },
  { id: "small", label: "Smallest first" },
];

export function sortList(l: CatalogEntry[], s: Sort): CatalogEntry[] {
  const name = (a: CatalogEntry, b: CatalogEntry) => a.name.localeCompare(b.name, "sv") || a.variant.localeCompare(b.variant, "sv");
  const by: Record<Sort, (a: CatalogEntry, b: CatalogEntry) => number> = {
    name,
    quick: (a, b) => a.minutes - b.minutes || name(a, b),
    easy: (a, b) => a.difficulty - b.difficulty || a.minutes - b.minutes || name(a, b),
    small: (a, b) => a.size.w * a.size.h * a.size.d - b.size.w * b.size.h * b.size.d || name(a, b),
  };
  return [...l].sort(by[s]);
}

/** Filters by facet id, each a set of option ids: any option of a facet will do, every facet must hold (as on JYSK). */
export type Filters = Record<string, string[]>;
export const NO_FILTERS: Filters = {};

type Def = { id: string; label: string; values: (e: CatalogEntry) => [id: string, label: string][]; rank?: (id: string) => number; swatch?: boolean };

/** A fact JYSK gives for a product (src/lib/ikea.ts facts), its words as the option. */
const fact = (id: string, label: string, numeric = false): Def => ({ id, label, values: (e) => (e.facts?.[id] ?? []).map((v) => [idOf(v), v]), rank: numeric ? (v) => parseFloat(v) : undefined });

/** A measure in bands: "under 40 cm", "40 to 60 cm", "200 cm and over". */
function bands(id: string, label: string, edges: number[], get: (e: CatalogEntry) => number, unit: (n: number) => string): Def {
  return {
    id,
    label,
    values: (e) => {
      const v = get(e);
      const i = edges.findIndex((x) => v < x);
      if (i === 0) return [[`0-${edges[0]}`, `Under ${unit(edges[0])}`]];
      if (i < 0) return [[`${edges[edges.length - 1]}-`, `${unit(edges[edges.length - 1])} and over`]];
      return [[`${edges[i - 1]}-${edges[i]}`, `${edges[i - 1]} to ${unit(edges[i])}`]];
    },
    rank: (v) => parseFloat(v),
  };
}
const cm = (n: number) => `${n} cm`;
const time = (n: number) => (n < 60 ? `${n} min` : `${n / 60} h`);
const LEVEL = ["", "Easy", "Medium", "Hard"];
const COLOUR_ORDER = COLOURS.map(([id]) => id);

/** Every filter, most telling first: the first few a category has are the buttons over its grid, the rest wait in "All filters". */
export const DEFS: Def[] = [
  fact("bed", "Mattress size"),
  fact("seats", "Seats", true),
  fact("drawers", "Drawers", true),
  fact("doors", "Doors", true),
  fact("shelves", "Shelves", true),
  fact("shape", "Shape"),
  { id: "colour", label: "Colour", swatch: true, values: (e) => coloursOf(e).map((c) => [c, COLOURS.find((x) => x[0] === c)![1]]), rank: (v) => COLOUR_ORDER.indexOf(v) },
  bands("width", "Width", [40, 60, 80, 100, 120, 150, 200], (e) => e.size.w, cm),
  bands("height", "Height", [50, 80, 100, 150, 200], (e) => e.size.h, cm),
  bands("depth", "Depth", [30, 40, 50, 60, 80, 100], (e) => e.size.d, cm),
  fact("material", "Material"),
  fact("feature", "Feature"),
  bands("time", "Build time", [30, 60, 120], (e) => e.minutes, time),
  { id: "level", label: "Difficulty", values: (e) => [[String(e.difficulty), LEVEL[e.difficulty] ?? String(e.difficulty)]], rank: Number },
  fact("parcels", "Boxes", true),
  { id: "series", label: "Series", values: (e) => [[seriesOf(e), e.name]] },
];

/** Products that pass every filter but `skip`: what a facet's own counts are taken over, so each option shows what picking it gives. */
export function applyFilters(l: CatalogEntry[], f: Filters, skip?: string): CatalogEntry[] {
  const on = DEFS.filter((d) => d.id !== skip && f[d.id]?.length);
  return on.length ? l.filter((e) => on.every((d) => d.values(e).some(([id]) => f[d.id].includes(id)))) : l;
}

export type FacetGroup = { id: string; label: string; swatch?: boolean; options: Facet[] };

/** Each filter's options over the products in view, with how many each would give; a filter with one option is left out. */
export function facets(l: CatalogEntry[], f: Filters): FacetGroup[] {
  return DEFS.flatMap((d) => {
    const m = new Map<string, Facet>();
    for (const e of applyFilters(l, f, d.id))
      for (const [id, label] of d.values(e)) {
        const o = m.get(id);
        if (o) o.n++;
        else m.set(id, { id, label, n: 1 });
      }
    const options = [...m.values()].sort((a, b) => (d.rank ? d.rank(a.id) - d.rank(b.id) : 0) || a.label.localeCompare(b.label, "sv"));
    return options.length > 1 || f[d.id]?.length ? [{ id: d.id, label: d.label, swatch: d.swatch, options }] : [];
  });
}

/** The filters in an address: ?colour=white,black&width=80-100. */
export const readFilters = (p: URLSearchParams): Filters => Object.fromEntries(DEFS.flatMap((d) => (p.get(d.id) ? [[d.id, p.get(d.id)!.split(",")]] : [])));
export const writeFilters = (f: Filters, p = new URLSearchParams()) => {
  for (const d of DEFS) if (f[d.id]?.length) p.set(d.id, f[d.id].join(","));
  return p;
};
