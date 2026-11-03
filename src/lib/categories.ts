import type { Kind } from "./products";

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
