import { PRODUCTS, type CatalogEntry } from "./catalog";
import { fold } from "./fold";

/**
 * JYSK's own category tree, built from each guide's breadcrumb (Bedroom > Beds > Children's Beds) and addressed the way
 * jysk.co.uk addresses it (/bedroom/beds/childrens-beds), so a JYSK address works here with only the domain changed.
 * Only categories with a guide in them exist. The root is /browse, every guide.
 */
export type CatNode = { href: string; label: string; parent?: CatNode; children: CatNode[]; guides: CatalogEntry[] };

// JYSK's slug for a category name: lower case, apostrophes dropped, words joined by dashes. JYSK's exceptions are listed
// here; npm run jysk:check fails on a new one (it checks every address against scripts/jysk/range.txt)
const SLUG: Record<string, string> = { "Chest of Drawers": "chest-drawers" };
export const catSlug = (name: string) => SLUG[name] ?? fold(name.replace(/['’]/g, "")).replace(/\s+/g, "-");

/** JYSK names that read oddly on their own. */
const LABEL: Record<string, string> = { "Misc.": "Other storage" };

/** The rooms in the order a shop walks them; one not named here goes after these. */
const ROOM_ORDER = ["/bedroom", "/living-room", "/dining-room", "/office", "/storage", "/hall", "/bathroom", "/garden"];

export const ROOT: CatNode = { href: "", label: "All guides", children: [], guides: PRODUCTS };
for (const e of PRODUCTS) {
  let at = ROOT;
  for (const name of e.path ?? []) {
    const href = at.href + "/" + catSlug(name);
    let c = at.children.find((x) => x.href === href);
    if (!c) at.children.push((c = { href, label: LABEL[name] ?? name, parent: at, children: [], guides: [] }));
    c.guides.push(e);
    at = c;
  }
}
const rank = (href: string) => ROOM_ORDER.indexOf(href) + 1 || 99;
ROOT.children.sort((a, b) => rank(a.href) - rank(b.href));
// below the rooms, the biggest categories first
const sortDown = (n: CatNode) => n.children.forEach((c) => (c.children.sort((a, b) => b.guides.length - a.guides.length || a.label.localeCompare(b.label)), sortDown(c)));
sortDown(ROOT);

export const ROOMS = ROOT.children;

/** Every category below the root, parents before their children. */
export const NODES: CatNode[] = [];
const walk = (n: CatNode) => n.children.forEach((c) => (NODES.push(c), walk(c)));
walk(ROOT);
const BY_HREF = new Map(NODES.map((n) => [n.href, n]));

/** The category at an address ("/bedroom/beds"); "" or "/browse" is the root. */
export const nodeAt = (href: string) => (href === "" || href === "/browse" ? ROOT : BY_HREF.get(href));

/** The address a category's page lives at. */
export const pageOf = (n: CatNode) => n.href || "/browse";

/** The categories above one, the room first. */
export const trail = (n: CatNode) => {
  const out: CatNode[] = [];
  for (let p = n.parent; p && p !== ROOT; p = p.parent) out.unshift(p);
  return out;
};

/** A crumb as a page shows it: a link and its name. */
export type Crumb = { href: string; label: string };

/** The categories a guide sits in, from its JYSK breadcrumb, room first: what its page's breadcrumb links to. */
export const crumbsOf = (e: CatalogEntry): Crumb[] => {
  const out: Crumb[] = [];
  let href = "";
  for (const name of e.path ?? []) {
    const n = nodeAt((href += "/" + catSlug(name)));
    if (n) out.push({ href: n.href, label: n.label });
  }
  return out;
};

/** The category in a sentence: "bed frames", or "bedroom furniture" for a room. */
export const catNoun = (n: CatNode) => (n.parent === ROOT ? n.label + " furniture" : n.label).toLowerCase();

/** The guide whose drawing stands for a category: a featured one if it has one. */
export const coverOf = (n: CatNode) => n.guides.find((e) => e.featured) ?? n.guides.find((e) => e.checked) ?? n.guides[0];
