import type { Kind, X } from "./products";
import type { Colour } from "./types";
import { fold } from "./fold";
// ponytail: IKEA's name data was removed in Phase 0; these lookups find nothing until JYSK has an equivalent
const IKEA_GUARD = "";

/**
 * Catalog rows (src/data/jysk-rows.ts, written by scripts/jysk/build.ts), one per line:
 * name|kind|variant|w|h|d|params|keywords|slug|manual|colours, colours as name=article=hex (hex optional), comma separated.
 * The IKEA name lookups below are stubs left from Bygga until they are replaced or removed.
 */

export interface IkeaRow {
  name: string;
  kind: Kind;
  variant: string;
  w: number;
  h: number;
  d: number;
  x: X;
  keywords?: string[];
  /** only stored when it differs from the slug the name and variant give */
  slug?: string;
  /** the maker's own assembly manual (PDF) */
  manual?: string;
  colours?: Colour[];
}

const X_KEYS = ["rows", "cols", "knobs", "plinth", "doors", "shelves", "c", "m", "l", "f", "seats", "arms", "legs", "attach", "shelf", "min", "round", "seatH", "chaise", "corner", "open", "sd", "drawer", "leaves", "leaf", "under", "mats", "dtop", "rail", "slides", "n", "of", "hinge", "use", "z", "basin", "hung", "uf", "ins", "blind", "inner", "u", "v", "cu", "rock", "cat", "cast", "mods", "dr", "foot", "st", "low", "box", "t", "mirror", "up", "us", "ah", "aw", "bk", "lg", "sdp"] as const;
const FLAGS = new Set<string>(["plinth", "shelf", "round", "open", "drawer", "dtop", "rail", "hinge", "hung", "rock", "cast", "foot", "mirror", "us"]);
const WORDS = new Set<string>(["knobs", "arms", "legs", "attach", "chaise", "corner", "under", "of", "use", "z", "inner", "u", "v", "cat"]);

export function encodeX(x: X): string {
  const out: string[] = [];
  for (const k of X_KEYS) {
    const v = x[k];
    if (v === undefined) continue;
    out.push(`${k}=${typeof v === "boolean" ? (v ? 1 : 0) : v}`);
  }
  return out.join(",");
}

export function decodeX(s: string): X {
  const x: Record<string, unknown> = {};
  if (!s) return x as X;
  for (const pair of s.split(",")) {
    const [k, v] = pair.split("=");
    x[k] = FLAGS.has(k) ? v === "1" : WORDS.has(k) ? v : Number(v);
  }
  return x as X;
}

export function encodeRow(r: IkeaRow): string {
  const cells = [r.name, r.kind, r.variant, r.w, r.h, r.d, encodeX(r.x), (r.keywords ?? []).join(" "), r.slug ?? "", r.manual ?? "", (r.colours ?? []).map((c) => [c.name, c.sku, c.hex ?? ""].join("=")).join(",")].map(String);
  for (const c of cells) if (/[|\n`\\]|\$\{/.test(c)) throw new Error(`can't store ${JSON.stringify(c)}`);
  while (cells.length && !cells[cells.length - 1]) cells.pop();
  return cells.join("|");
}

export function decodeRows(text: string): IkeaRow[] {
  const out: IkeaRow[] = [];
  for (const line of text.split("\n")) {
    if (!line) continue;
    const [name, kind, variant, w, h, d, x = "", kw = "", slug = "", manual = "", colours = ""] = line.split("|");
    out.push({ name, kind: kind as Kind, variant, w: Number(w), h: Number(h), d: Number(d), x: decodeX(x), keywords: kw ? kw.split(" ") : undefined, slug: slug || undefined, manual: manual || undefined, colours: colours ? colours.split(",").map((c) => { const [n, sku, hex] = c.split("="); return { name: n, sku, ...(hex ? { hex } : {}) }; }) : undefined });
  }
  return out;
}

/* ---------- names ---------- */

const guard = new Set(IKEA_GUARD.split(" "));

/** A real IKEA name we can't draw, which search must not read as a typo of one we can (FRÖSÖN is not FRÖSET). */
export function isGuardedName(word: string) {
  return guard.has(fold(word).replace(/\s+/g, ""));
}

let names: Promise<Map<string, string[]>> | null = null;

function nameMap() {
  names ??= Promise.resolve({ IKEA_NAMES: "" }).then(({ IKEA_NAMES }) => {
    const map = new Map<string, string[]>();
    for (const line of IKEA_NAMES.split("\n")) {
      if (!line) continue;
      const [n, t = ""] = line.split("|");
      map.set(fold(n), t ? t.split(";") : []);
    }
    return map;
  });
  return names;
}

/** True when this is the name of a real IKEA product family, drawable or not. */
export async function isIkeaName(name: string) {
  return (await nameMap()).has(fold(name));
}

/** IKEA's own product types for a family name, most common first ("BESTÅ" gives ["TV bench", "TV bench with doors"]). */
export async function ikeaTypes(name: string): Promise<string[]> {
  return (await nameMap()).get(fold(name)) ?? [];
}

/**
 * The main IKEA product type for a family name ("MARKUS" gives "Office chair"), or null when it isn't
 * a name we know. Also takes a whole query and uses its first word: "markus chair" works too.
 */
export async function ikeaType(name: string): Promise<string | null> {
  const map = await nameMap();
  const f = fold(name);
  return (map.get(f) ?? map.get(f.split(" ")[0]) ?? [])[0] ?? null;
}

/* ---------- article numbers ---------- */

/** A JYSK article number, "3670661" (spaces allowed), or a jysk.co.uk/product-lookup/3670661 link, as 7 digits. */
export function articleNo(q: string): string | null {
  const d = q.replace(/\s/g, "");
  if (/^\d{7}$/.test(d)) return d;
  const link = q.match(/jysk\.[a-z.]+\/product-lookup\/(\d{7})\b/i);
  return link ? link[1] : null;
}
