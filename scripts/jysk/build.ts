// Turns scripts/jysk/facts.json into the rows we draw: npm run jysk:build
// Out: src/data/jysk-rows.ts (one row per line, see encodeRow in src/lib/ikea.ts).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeRow, type IkeaRow } from "@/lib/ikea";
import type { Facts } from "./fetch";

const DIR = import.meta.dirname;
const OUT = path.join(DIR, "../../src/data/jysk-rows.ts");

const num = (s?: string) => (s ? Number(s.match(/\d+/)?.[0]) : undefined);

/** "Width 81 cm, Height 101 cm, Depth 48 cm" as [w, h, d] in cm. Without a Depth the Length is: a bed's width is its
 *  width and its length runs back (a desk or table reorders this itself); a round table gives its Diameter. */
function size(s: string): [number, number, number] | null {
  const get = (k: string) => Number(s.match(new RegExp(`${k} (\\d+(?:\\.\\d+)?) cm`))?.[1]) || 0;
  const [W, H, D, L, R] = [get("Width"), get("Height"), get("Depth"), get("Length"), get("Diameter")];
  const v: [number, number, number] = R ? [R, H, R] : [W, H, D || L];
  return v.every((n) => n > 0) ? v : null;
}

/** A colour's look in the drawing per JYSK colour name, sampled (median) from a patch on that colour's part in JYSK's own
 *  product photos. Black is lifted to charcoal so the ink edges still read. A family that looks different has its own
 *  "family:name" entry. White alone stays the drawing's own white. */
const HEX: Record<string, string> = {
  beige: "e2dad1", "light oak": "c4ab99", "wild natural oak": "ba8e6e", black: "3d3b39", white: "ffffff",
  "warm oak": "ba9d81", "natural oak": "e1cdb5", "dark oak": "817268", "natural wood": "d3b99a", natural: "a3835f",
  concrete: "9c9c9c", travertine: "ddd8d4",
  "abbetved:light oak": "d7cfc0", "trappedal:beige": "b7b3ad", "billund:beige": "d2cbc4",
};
const hexOf = (family: string, name: string) => HEX[`${family.toLowerCase()}:${name.toLowerCase()}`] ?? HEX[name.toLowerCase()];
/** How each colour in a name looks, in order ("Light oak+White" -> [oak, white]); a single white needs no tint. */
const tones = (family: string, name: string) => {
  const t = name.split("+").map((p) => hexOf(family, p.trim()));
  if (t.some((h) => !h)) return {};
  return t.length === 1 && t[0] === "ffffff" ? {} : { tones: t as string[] };
};

// Every product gets a row: a case this doesn't cover yet means extending classify(), never skipping it.
// Counts the page doesn't give are left out, so specFor's defaults apply.
function classify(f: Facts): { row: IkeaRow } | { skip: string } {
  const dims = size(f.specs["Size assembled"] ?? "");
  if (!dims) return { skip: `no assembled size: ${f.specs["Size assembled"]}` };
  const [w, h, d] = dims;
  const name = f.family;
  // one guide covers every colour, so the page's own colour comes off the end of the name
  // the page names its colour its own way ("warm oak colour/black" for "Warm oak+Black"): cut where its first word starts
  const plain = f.name.replace(new RegExp(`\\s*${f.family}\\s*`, "i"), " ").trim();
  const first = f.colours[0].name.split(/[+ ]/)[0].toLowerCase();
  const at = first ? plain.toLowerCase().lastIndexOf(" " + first) : -1;
  const variant = (at > 0 ? plain.slice(0, at) : plain).trim().replace(/^./, (c) => c.toUpperCase());
  const colours = f.colours.map((c) => ({ ...c, ...tones(f.family, c.name) }));
  const base = { name, variant, w, h, d, colours, slug: f.slug, manual: f.manual };
  const drawers = num(f.specs["Number of drawers"]);
  const c = f.category;
  // the browse tabs for children's and garden furniture go by these tags
  const tags = [...(/child|kid/i.test(c) ? ["kids"] : []), ...(/garden|outdoor/i.test(c) ? ["outdoor"] : [])];
  const row = (kind: IkeaRow["kind"], x: IkeaRow["x"] = {}, at: [number, number, number] = [w, h, d]) =>
    ({ row: { ...base, w: at[0], h: at[1], d: at[2], kind, x, ...(tags.length ? { keywords: tags } : {}) } }) as const;
  // a desk or table's "Width" can be its short side: the longer one is w
  const wide: [number, number, number] = [Math.max(w, d), h, Math.min(w, d)];
  if (/chest of drawers/i.test(c)) {
    // "3+3 drawer chest": two columns side by side, when the counts agree
    const cols = f.name.match(/\b(\d)\+(\d)\b/);
    const two = cols && cols[1] === cols[2] && (!drawers || Number(cols[1]) * 2 === drawers);
    return row("chest", two ? { rows: Number(cols[1]), cols: 2 } : { rows: drawers });
  }
  if (/wardrobe/i.test(c)) {
    const doors = num(f.specs["Number of doors"]);
    const shelves = num(f.specs["Number of shelves"]);
    if (/sliding/i.test(f.specs["Type"] ?? "")) return row("sliding", { slides: doors, shelves });
    // any number of hinged doors: generic builders draw up to 2, a family file draws the real thing
    // with drawers it is the "mixed" kind (a wardrobe with drawers), else a plain wardrobe
    return row(drawers ? "mixed" : "wardrobe", { doors, shelves, rail: !!num(f.specs["Number of hanging rails"]), rows: drawers });
  }
  // doors over drawers without a rail: a cabinet with doors and drawers
  if (/sideboard|cabinet/i.test(c)) return row(drawers ? "mixed" : "sideboard", { doors: num(f.specs["Number of doors"]), shelves: num(f.specs["Number of shelves"]), rows: drawers });
  // open shelving: no back panel unless a family file says otherwise
  if (/bookshel|shelving/i.test(c)) return row("open", { shelves: num(f.specs["Number of shelves"]) });
  if (/desk/i.test(c)) return row(drawers ? "deskdraw" : "desk", { rows: drawers }, wide);
  if (/bed/i.test(c)) {
    // the mattress it takes, "135x190 - Double"; drawers under it are drawn by a family file
    const m = (f.specs["Size"] ?? "").match(/(\d+)x(\d+)/);
    return row("bed", { ...(m ? { m: Number(m[1]), l: Number(m[2]) } : {}), rows: drawers });
  }
  // a round table gives its diameter as w and d
  if (/table/i.test(c)) return row("dining", f.specs["Size assembled"]?.includes("Diameter") ? { round: true } : {}, wide);
  if (/chair|stool/i.test(c)) return row("chair");
  if (/sofa/i.test(c)) return row("sofa", { seats: num(f.specs["Type"]) ?? num(f.name.match(/(\d)[ -]seater/i)?.[1]) });
  return { skip: `category not classified yet: ${c}` };
}

const facts: Facts[] = JSON.parse(readFileSync(path.join(DIR, "facts.json"), "utf8"));
const rows: string[] = [];
for (const f of facts) {
  const c = classify(f);
  if ("skip" in c) {
    console.log(`skip ${f.colours[0].sku} ${f.name}: ${c.skip}`);
    continue;
  }
  rows.push(encodeRow(c.row));
}
// nothing is dropped quietly: teach classify() the missing case
if (rows.length < facts.length) {
  console.error(`${facts.length - rows.length} product(s) not classified: update classify() in scripts/jysk/build.ts`);
  process.exit(1);
}
writeFileSync(
  OUT,
  `// Generated by scripts/jysk/build.ts from JYSK UK product pages. Do not edit by hand.\n// Rows we can draw, one per line: name|kind|variant|w|h|d|params|keywords|slug|manual|colours (colours: name=article=hex)\nexport const JYSK_ROWS = \`${rows.join("\n")}\`;\n`,
);
console.log(`${rows.length} of ${facts.length} products -> src/data/jysk-rows.ts`);
