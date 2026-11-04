// Turns scripts/jysk/facts.json into the rows we draw: npm run jysk:build
// Out: src/data/jysk-rows.ts (one row per line, see encodeRow in src/lib/ikea.ts).
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodeRow, type IkeaRow } from "@/lib/ikea";
import type { Facts } from "./fetch";

const DIR = import.meta.dirname;
const OUT = path.join(DIR, "../../src/data/jysk-rows.ts");

const num = (s?: string) => (s ? Number(s.match(/\d+/)?.[0]) : undefined);

/** One measure from a size line: "Height 70-119 cm" (adjustable) and "Length 172/276 cm" (extends, lifts, a nest of two)
 *  both read as the first figure, the product as it stands put away; `far` takes the last one instead (a chaise longue's depth). */
function measure(s: string, k: string, far = false): number {
  const m = s.match(new RegExp(`${k} (\\d+(?:\\.\\d+)?(?:\\s*[-/]\\s*D?\\d+(?:\\.\\d+)?)*) cm`));
  if (!m) return 0;
  const all = m[1].split(/[-/]/).map((t) => Number(t.replace(/[^\d.]/g, "")));
  return (far ? all[all.length - 1] : all[0]) || 0;
}

/** "Width 81 cm, Height 101 cm, Depth 48 cm" as [w, h, d] in cm. Without a Depth the Length is: a bed's width is its
 *  width and its length runs back (a desk or table reorders this itself); a round table gives its Diameter. */
function size(s: string, far = false): [number, number, number] | null {
  const [W, H, D, L, R] = ["Width", "Height", "Depth", "Length", "Diameter"].map((k) => measure(s, k, far && k === "Depth"));
  // a round thing gives its Diameter, and something small on the wall (a hook) gives no height of its own
  const v: [number, number, number] = R ? [R, H || R, D || R] : [W, H, D || L];
  return v.every((n) => n > 0) ? v : null;
}

/** A colour's look in the drawing per JYSK colour name, sampled (median) from a patch on that colour's part in JYSK's own
 *  product photos. Black is lifted to charcoal so the ink edges still read. A family that looks different has its own
 *  "family:name" entry. White alone stays the drawing's own white. Colours not here yet are drawn in the plain board colour. */
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
// JYSK's category says what it is; the name says the rest (a pedestal among the side tables, a daybed among the sofa beds).
// Counts the page doesn't give are left out, so specFor's defaults apply.
function classify(f: Facts): { row: IkeaRow } | { skip: string } {
  const c = f.category;
  const n = f.name.toLowerCase();
  // a chaise longue's depth is given as seat/chaise: the drawing takes the whole depth, the seat depth goes in x.sd
  const chaise = /chaise/.test(n);
  const dims = size(f.specs["Size assembled"] ?? "", chaise);
  if (!dims) return { skip: `no assembled size: ${f.specs["Size assembled"]}` };
  const [w, h, d] = dims;
  // house rule: no en or em dashes, JYSK's own names included ("TYPE Z – RAZER EDITION")
  const name = f.family.replace(/\s*[\u2013\u2014]\s*/g, " - ");
  // one guide covers every colour, so the page's own colour comes off the end of the name
  // the page names its colour its own way ("warm oak colour/black" for "Warm oak+Black"): cut where its first word starts
  const plain = f.name.replace(new RegExp(`\\s*${f.family}\\s*`, "i"), " ").trim();
  const first = f.colours[0].name.split(/[+ ]/)[0].toLowerCase();
  const at = first ? plain.toLowerCase().lastIndexOf(" " + first) : -1;
  const variant = (at > 0 ? plain.slice(0, at) : plain).trim().replace(/\s*[\u2013\u2014]\s*/g, " - ").replace(/^./, (ch) => ch.toUpperCase());
  const colours = f.colours.map((col) => ({ ...col, ...tones(f.family, col.name) }));
  const base = { name, variant, w, h, d, colours, slug: f.slug, manual: f.manual, path: f.crumbs };
  // a count from the spec rows, else from the name ("2 doors 3 drawers", "5 shelves", "3 comp.")
  const count = (spec: string, word: RegExp) => num(f.specs[spec]) || Number(n.match(new RegExp(`(\\d+)\\s*(?:${word.source})`))?.[1]) || undefined;
  const drawers = count("Number of drawers", /drawers?|draw\b|dra\b|d\.(?= |$)|boxes/);
  const doors = count("Number of doors", /(?:tambour |glass )?doors?\b|do\b/);
  const shelves = count("Number of shelves", /(?:adjustable )?shelves|shelf|sh\./);
  const round = (f.specs["Size assembled"] ?? "").includes("Diameter");
  // the browse tabs for children's and garden furniture go by these tags, from the category or where JYSK files it
  const where = [c, ...(f.crumbs ?? [])].join(" ");
  const tags = [...(/child|kid/i.test(where) ? ["kids"] : []), ...(/garden|outdoor/i.test(where) ? ["outdoor"] : [])];
  const row = (kind: IkeaRow["kind"], x: IkeaRow["x"] = {}, s: [number, number, number] = [w, h, d]) => {
    for (const k of Object.keys(x) as (keyof IkeaRow["x"])[]) if (x[k] === undefined) delete x[k];
    return { row: { ...base, w: s[0], h: s[1], d: s[2], kind, x, ...(tags.length ? { keywords: tags } : {}) } } as const;
  };
  // a desk or table's "Width" can be its short side: the longer one is w
  const wide: [number, number, number] = [Math.max(w, d), h, Math.min(w, d)];
  // "3+3 drawer chest": two columns side by side, when the counts agree
  const cols = f.name.match(/\b(\d)\+(\d)\b/);
  const twin = cols && cols[1] === cols[2] ? Number(cols[1]) : 0;
  const seats = num(f.specs["Type"]) || Number(n.match(/(\d)(?:\.5)?[ -]?(?:seater|pers)/)?.[1]) || undefined;

  switch (c) {
    case "Chest of Drawers":
      if (doors) return row("mixed", { doors, rows: drawers });
      return row("chest", twin ? { rows: twin, cols: 2 } : { rows: drawers });
    case "Bedside Tables":
      if (doors && !drawers) return row("cabinet", { doors, shelves: 1 });
      return row("nightstand", { rows: drawers ?? 1 });
    case "Wardrobes":
      if (/sliding/i.test(f.specs["Type"] ?? "") || /sliding/.test(n)) return row("sliding", { slides: doors, shelves });
      // any number of hinged doors: generic builders draw up to 2, a family file draws the real thing
      // with drawers it is the "mixed" kind (a wardrobe with drawers), else a plain wardrobe
      return row(drawers ? "mixed" : "wardrobe", { doors, shelves, rail: !!num(f.specs["Number of hanging rails"]) || !/shelv/.test(n), rows: drawers });
    case "Sideboards":
    case "Cabinets":
      // the top section that stands on a sideboard
      if (/^top section/.test(n)) return row("extension", { doors });
      if (drawers) return row("mixed", { doors: doors ?? 0, shelves, rows: drawers });
      if (c === "Sideboards") return row("sideboard", { doors });
      return row("cabinet", { doors, shelves });
    case "Bookshelves and Room Dividers":
      if (/drawer chest/.test(n)) return row("chest", { rows: drawers });
      if (/room divider/.test(n)) return row("cube");
      if (/module .*cabinet/.test(n)) return row("cabinet", { doors: 1, shelves: 1 });
      if (drawers) return row("mixed", { doors: doors ?? 0, rows: drawers, shelves });
      // doors at the bottom, open shelves above
      if (doors) return row("cabinet", { doors, low: Math.round(h * 0.4) });
      if (/bookcase/.test(n)) return row("bookcase", { shelves: shelves && shelves > 1 ? shelves - 1 : shelves });
      return row("open", { shelves });
    case "Shelves":
      return row("wallshelf", { shelves: /floating/.test(n) ? 0 : shelves });
    case "Shoe Storage":
      if (/cabinet/.test(n)) return row("shoe", { c: count("Number of compartments", /comp(?:artments?|\.)?/) });
      return row("shoerack", { shelves: shelves && shelves > 1 ? shelves - 1 : 0 });
    case "Coat & Shoe Racks":
      if (drawers) return row("mixed", { doors: doors ?? 0, rows: drawers, rail: false });
      if (doors) return row("cabinet", { doors, shelves: 2 });
      return row("open", { shelves: shelves ?? 3 });
    case "Coat Racks":
      return row("hatrack");
    case "Coat Stands":
      return row("coatstand");
    case "Clothes Rails":
      return row("clothesrack", /shoe shelf|shelf/.test(n) ? { shelf: true } : {});
    case "Hallway Benches":
    case "Garden Storage Boxes":
      if (/storage/.test(n)) return row("lidbox", { cat: c === "Hallway Benches" ? "Storage bench" : "Storage box" });
      if (/shel|tambour/.test(n)) return row("shelfbench");
      return row("bench");
    case "Misc.":
      if (/trolley/.test(n)) return row("trolley", { shelves: shelves ? shelves - 1 : undefined });
      if (/wall cabinet/.test(n)) return row("wallcab", { doors: doors ?? 1 });
      if (/boxes/.test(n)) return row("chest", { rows: drawers });
      if (/wall panel/.test(n)) return row("wallshelf", { shelves: 0 });
      break;
    case "Coffee Tables & Side Tables":
      if (/^coffee table/.test(n)) return row("coffee", { shelf: /shelf/.test(n), ...(round ? { round: true } : {}) }, wide);
      return row("side", round ? { round: true } : {}, wide);
    case "Garden Coffee & Side Tables":
      return row(w >= 70 ? "coffee" : "side", { shelf: false, ...(round ? { round: true } : {}) }, wide);
    case "Console Tables":
      if (/dressing table/.test(n)) return row("deskdraw", { rows: drawers ?? 1, mirror: /mirror/.test(n) || undefined });
      if (drawers) return row("deskdraw", { rows: drawers });
      if (doors) return row("sideboard", { doors });
      return row("console", { shelf: /shelf/.test(n) || undefined });
    case "Desks":
    case "Standing Desks":
      return row(drawers ? "deskdraw" : "desk", { rows: drawers }, wide);
    case "Dining Tables":
    case "Composite Garden Tables":
    case "Metal Garden Tables":
    case "Wooden Garden Tables":
    case "Bistro Tables":
    case "Camping Tables & Folding Tables":
      if (/bar table/.test(n) || h > 95) return row("bar", round ? { round: true } : {}, wide);
      if (h < 65) return row("side", round ? { round: true } : {}, wide);
      return row("dining", round ? { round: true } : {}, wide);
    case "Bar Stools & Bar Tables":
      if (/table/.test(n)) return row("bar", round ? { round: true } : {}, wide);
      // a tall stool with a backrest is built like a chair on long legs
      return h > 90 ? row("chair", { seatH: 75 }) : row("stool");
    case "Dining Chairs":
    case "Plastic Garden Chairs":
    case "Wicker & Metal Garden Chairs":
      return row("chair", /armrest|armchair/.test(n) ? { arms: "slim" } : {});
    case "Office Chairs":
    case "Gaming Chairs":
      return row("office", { arms: /without arm/.test(n) ? "none" : "slim" });
    case "Garden Lounge Chairs":
    case "Hammocks & Swing Chairs":
      return row("lounge");
    case "Sun Loungers":
      return row("lounger");
    case "Garden Benches":
      return row("backbench");
    case "Garden Lounge Sets":
      // the set's sofa as the drawing: a corner when it is deep enough to turn one
      if (d > 140) return row("corner", { seats: 4 });
      return row("sofa", { seats: Math.min(4, Math.max(2, Math.round((w - 30) / 62))) });
    case "Pouffes":
      if (/storage/.test(n)) return row("lidbox", { cat: "Pouffe" });
      return row("pouffe", round ? { round: true } : {});
    case "Armchairs":
      if (/^footstool/.test(n)) return row("pouffe");
      if (/swivel/.test(n)) return row("swivel");
      return row("armchair", /footstool/.test(n) ? { foot: true } : {});
    case "Modular Sofas":
      // a pair of armrests sold on their own: a one-seat section is the nearest drawing
      if (/corner/.test(n)) return row("section", { corner: "left" });
      return row("section", { seats: 1 });
    case "Sofas":
    case "Sofa Beds": {
      if (/^daybed/.test(n)) {
        const m = f.name.match(/(\d+)x(\d+)/);
        return row("daybed", m ? { m: Math.min(Number(m[1]), Number(m[2])), l: Math.max(Number(m[1]), Number(m[2])) } : {});
      }
      if (chaise) {
        const sd = measure(f.specs["Size assembled"] ?? "", "Depth");
        return row("chaise", { chaise: /left/.test(n) ? "left" : "right", sd, seats: seats ?? 3 });
      }
      return row("sofa", { seats });
    }
    case "Bed Frames":
    case "Children's Beds":
    case "Folding Beds":
    case "Divan Bed Bases": {
      // the mattress it takes, "135x190 - Double" or in the name; drawers under it are drawn by a family file
      const m = (f.specs["Size"] ?? "").match(/(\d+)x(\d+)/) ?? f.name.match(/(\d+)(?:\/\d+)?x(\d+)/);
      const mx = m ? { m: Number(m[1]), l: Number(m[2]) } : {};
      if (/bunk/.test(n)) return row("bunk", mx, [w, h, Math.min(d, w)]);
      return row("bed", { ...mx, rows: drawers });
    }
    case "TV Units":
      if (/stand/.test(n)) return row("console", { shelf: true });
      if (drawers && !doors) return row("tv", { rows: drawers });
      if (drawers) return row("mixed", { doors, rows: drawers });
      return row("tv", { doors: doors ?? 0 });
    case "Bathroom Storage":
      return row("open", { shelves });
  }
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
