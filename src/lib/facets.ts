import type { CatalogEntry } from "./catalog";
import { fold } from "./fold";
import { TYPE_LABEL } from "./categories";

/**
 * The browse filters, read from JYSK's own filing of each product (its breadcrumb, src/lib/ikea.ts path):
 * the room is the first crumb, the type the last. Colours are grouped by their main word, so "Light oak" and
 * "Wild natural oak" are both Oak. Every facet is a short id that sits in the address (/browse/beds?room=bedroom).
 */

export type Facet = { id: string; label: string; n: number };

export const idOf = (s: string) => fold(s).replace(/\s+/g, "-");

/** The rooms in the order a shop walks them; one JYSK hasn't named here still shows, after these. */
const ROOM_ORDER = ["bedroom", "living-room", "dining-room", "office", "storage", "hall", "bathroom", "garden", "homeware"];
/** Room names on the filter where JYSK's department name reads oddly as a room. */
const ROOM_LABEL: Record<string, string> = { homeware: "Kids' room" };

export const roomOf = (e: CatalogEntry) => (e.path?.length ? idOf(e.path[0]) : null);
export const typeOf = (e: CatalogEntry) => (e.path && e.path.length > 1 ? idOf(e.path[e.path.length - 1]) : null);
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

export type Filters = { room: string; type: string; colour: string; series: string };
export const NO_FILTERS: Filters = { room: "", type: "", colour: "", series: "" };

/** Products that pass every filter but `skip`: what a facet's own counts are taken over, so each option shows what picking it gives. */
export function applyFilters(l: CatalogEntry[], f: Filters, skip?: keyof Filters): CatalogEntry[] {
  return l.filter(
    (e) =>
      (skip === "room" || !f.room || roomOf(e) === f.room) &&
      (skip === "type" || !f.type || typeOf(e) === f.type) &&
      (skip === "colour" || !f.colour || coloursOf(e).includes(f.colour)) &&
      (skip === "series" || !f.series || seriesOf(e) === f.series),
  );
}

function count(l: CatalogEntry[], key: (e: CatalogEntry) => string | string[] | null, label: (id: string, e: CatalogEntry) => string): Facet[] {
  const m = new Map<string, Facet>();
  for (const e of l) {
    const k = key(e);
    for (const id of Array.isArray(k) ? k : k ? [k] : []) {
      const f = m.get(id);
      if (f) f.n++;
      else m.set(id, { id, label: label(id, e), n: 1 });
    }
  }
  return [...m.values()];
}

/** Each filter's options over the products in view, with how many each would give. */
export function facets(l: CatalogEntry[], f: Filters) {
  const rooms = count(applyFilters(l, f, "room"), roomOf, (id, e) => ROOM_LABEL[id] ?? e.path![0]);
  const rank = (id: string) => (ROOM_ORDER.indexOf(id) + 1 || 99);
  rooms.sort((a, b) => rank(a.id) - rank(b.id) || a.label.localeCompare(b.label));
  const types = count(applyFilters(l, f, "type"), typeOf, (_, e) => {
    const t = e.path![e.path!.length - 1];
    return TYPE_LABEL[t] ?? t;
  }).sort((a, b) => a.label.localeCompare(b.label));
  const order = COLOURS.map(([id]) => id);
  const colours = count(applyFilters(l, f, "colour"), coloursOf, (id) => COLOURS.find((c) => c[0] === id)![1]).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  const series = count(applyFilters(l, f, "series"), seriesOf, (_, e) => e.name).sort((a, b) => a.label.localeCompare(b.label, "sv"));
  return { rooms, types, colours, series };
}
