import { KIND_ARCH, type Kind } from "./products";
import type { CatalogEntry } from "./catalog";
import type { Archetype } from "./types";

/**
 * Tabs over the kinds of furniture, each id also its address (/browse/beds). A JYSK product joins a tab by JYSK's own
 * product type (the last crumb of its path), limited to `arch` where one JYSK type holds two kinds of thing (bar stools
 * and bar tables); anything without a path goes by the kind that draws it. Kids and Garden cut across them, by keyword.
 */
export type Cat = { id: string; label: string; types?: string[]; arch?: Archetype[]; kinds?: Kind[]; tag?: string };

export const CATS: Cat[] = [
  { id: "all", label: "All" },
  {
    id: "beds",
    label: "Beds",
    types: ["Bed Frames", "Children's Beds", "Folding Beds", "Divan Bed Bases"],
    kinds: ["bed", "daybed", "bunk", "loft", "cot"],
  },
  { id: "drawers", label: "Drawers", types: ["Chest of Drawers", "Bedside Tables"], kinds: ["chest", "nightstand", "changing"] },
  { id: "wardrobes", label: "Wardrobes", types: ["Wardrobes", "Clothes Rails"], kinds: ["wardrobe", "sliding", "cornerrobe", "clothesrack"] },
  {
    id: "shelves",
    label: "Shelves",
    types: ["Bookshelves and Room Dividers", "Shelves", "Misc.", "Bathroom Storage"],
    kinds: ["cube", "bookcase", "open", "wallshelf", "bookrow", "divider"],
  },
  {
    id: "cabinets",
    label: "Cabinets",
    types: ["Sideboards", "Cabinets", "TV Units"],
    kinds: ["cabinet", "sideboard", "tv", "shoe", "shoerack", "wallcab", "kitchen", "cabrow", "slidecab", "mixed", "cornercab", "sinkcab", "appliance", "washstand"],
  },
  {
    id: "tables",
    label: "Tables",
    types: ["Dining Tables", "Coffee Tables & Side Tables", "Console Tables", "Bar Stools & Bar Tables"],
    arch: ["table"],
    kinds: ["dining", "coffee", "side", "bar", "console", "trolley", "dropleaf", "gateleg", "conftable"],
  },
  { id: "desks", label: "Desks", types: ["Desks", "Standing Desks"], kinds: ["desk", "cornerdesk", "deskdraw", "boxdesk"] },
  {
    id: "chairs",
    label: "Chairs",
    types: ["Dining Chairs", "Office Chairs", "Gaming Chairs", "Bar Stools & Bar Tables"],
    arch: ["seat"],
    kinds: ["chair", "stool", "bench", "backbench", "office", "conference", "highchair", "junior", "lounge"],
  },
  {
    id: "sofas",
    label: "Sofas",
    types: ["Sofas", "Sofa Beds", "Armchairs", "Modular Sofas", "Pouffes"],
    kinds: ["sofa", "armchair", "corner", "usofa", "section", "chaise", "swivel", "lounger"],
  },
  { id: "hall", label: "Hall", types: ["Coat & Shoe Racks", "Coat Racks", "Coat Stands", "Hallway Benches", "Shoe Storage"], kinds: ["hatrack", "coatstand"] },
  { id: "kids", label: "Kids", kinds: ["kidstable", "kidschair", "junior", "highchair", "cot", "changing"], tag: "kids" },
  { id: "garden", label: "Garden", tag: "outdoor" },
];

/** The tabs with a page of their own, /browse/<id> ("all" is /browse itself). */
export const TABS = CATS.filter((c) => c.id !== "all");

/** The category in a sentence: "wardrobes", or "garden furniture" for a tab that cuts across the types. */
export const catNoun = (c: (typeof CATS)[number]) => c.label.toLowerCase() + (c.tag ? " furniture" : c.id === "hall" ? " furniture" : "");

/** JYSK type names that read oddly on their own, as the filters show them. */
export const TYPE_LABEL: Record<string, string> = { "Misc.": "Other storage", "Bookshelves and Room Dividers": "Bookcases and room dividers" };

// a kind no tab names yet still lands in the tab for its furniture type
const LISTED = new Set(CATS.flatMap((c) => c.kinds ?? []));
// JYSK types two tabs share (bar stools and bar tables): there the kind of thing decides
const SHARED = new Set(CATS.flatMap((c) => c.types ?? []).filter((t, i, all) => all.indexOf(t) !== i));
const BY_ARCH: Record<Archetype, string> = { shelf: "shelves", drawers: "drawers", cabinet: "cabinets", table: "tables", bed: "beds", seat: "chairs", sofa: "sofas", custom: "cabinets" };

/** Whether a guide belongs under a tab. */
export const inCat = (e: CatalogEntry, c: (typeof CATS)[number]) => {
  if (!c.kinds && !c.tag && !c.types) return true;
  if (c.tag) return !!e.keywords?.includes(c.tag) || (!!e.kind && !!c.kinds?.includes(e.kind));
  // garden furniture lives in the Garden tab only, as it does on JYSK
  if (e.keywords?.includes("outdoor")) return false;
  // a JYSK product goes by JYSK's own type for it
  const type = e.path?.[e.path.length - 1];
  if (type) return !!c.types?.includes(type) && (!SHARED.has(type) || !c.arch || c.arch.includes(KIND_ARCH[e.kind!] ?? e.archetype));
  // a clothes rail makes it a wardrobe, whatever kind builds it (a wardrobe with drawers is the "mixed" kind)
  if (e.cabinet?.rail) return c.id === "wardrobes";
  if (!e.kind) return false;
  return !!c.kinds?.includes(e.kind) || (!LISTED.has(e.kind) && BY_ARCH[KIND_ARCH[e.kind] ?? e.archetype] === c.id);
};
