import { KIND_ARCH, type Kind } from "./products";
import type { CatalogEntry } from "./catalog";
import type { Archetype } from "./types";

/** Tabs over the kinds of furniture, each id also its address (/browse/beds). Kids and Garden cut across them, by keyword. */
export const CATS: { id: string; label: string; kinds?: Kind[]; tag?: string }[] = [
  { id: "all", label: "All" },
  { id: "shelves", label: "Shelves", kinds: ["cube", "bookcase", "open", "wallshelf", "bookrow", "divider"] },
  { id: "drawers", label: "Drawers", kinds: ["chest", "nightstand", "changing"] },
  { id: "wardrobes", label: "Wardrobes", kinds: ["wardrobe", "sliding", "cornerrobe", "clothesrack"] },
  {
    id: "cabinets",
    label: "Cabinets",
    kinds: ["cabinet", "sideboard", "tv", "shoe", "shoerack", "wallcab", "kitchen", "cabrow", "slidecab", "mixed", "cornercab", "sinkcab", "appliance", "washstand"],
  },
  { id: "tables", label: "Tables", kinds: ["dining", "coffee", "side", "bar", "console", "trolley", "dropleaf", "gateleg", "conftable"] },
  { id: "desks", label: "Desks", kinds: ["desk", "cornerdesk", "deskdraw", "boxdesk"] },
  { id: "beds", label: "Beds", kinds: ["bed", "daybed", "bunk", "loft", "cot"] },
  { id: "chairs", label: "Chairs", kinds: ["chair", "stool", "bench", "backbench", "office", "conference", "highchair", "junior", "lounge"] },
  { id: "sofas", label: "Sofas", kinds: ["sofa", "armchair", "corner", "usofa", "section", "chaise", "swivel", "lounger"] },
  { id: "kids", label: "Kids", kinds: ["kidstable", "kidschair", "junior", "highchair", "cot", "changing"], tag: "kids" },
  { id: "garden", label: "Garden", tag: "outdoor" },
];

/** The tabs with a page of their own, /browse/<id> ("all" is /browse itself). */
export const TABS = CATS.filter((c) => c.id !== "all");

/** The category in a sentence: "wardrobes", or "garden furniture" for a tab that cuts across the types. */
export const catNoun = (c: (typeof CATS)[number]) => c.label.toLowerCase() + (c.tag ? " furniture" : "");

const LISTED = new Set(CATS.flatMap((c) => c.kinds ?? []));
const BY_ARCH: Record<Archetype, string> = { shelf: "shelves", drawers: "drawers", cabinet: "cabinets", table: "tables", bed: "beds", seat: "chairs", sofa: "sofas", custom: "cabinets" };

/** Whether a guide belongs under a tab. */
export const inCat = (e: CatalogEntry, c: (typeof CATS)[number]) => {
  if (!c.kinds && !c.tag) return true;
  if (c.tag && e.keywords?.includes(c.tag)) return true;
  // a clothes rail makes it a wardrobe, whatever kind builds it (a wardrobe with drawers is the "mixed" kind)
  if (!c.tag && e.cabinet?.rail) return c.id === "wardrobes";
  if (!e.kind) return false;
  return !!c.kinds?.includes(e.kind) || (!LISTED.has(e.kind) && BY_ARCH[KIND_ARCH[e.kind] ?? e.archetype] === c.id);
};
