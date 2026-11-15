/**
 * Checks a guide against the maker's assembly manual: npm run qa:manual -- --only <slug> [--pdf <file>]
 * The PDF defaults to the product's manual link (spec.manual), fetched once into .qa/manual/<slug>/.
 * Reads the manual's text layer (poppler's pdftotext) and exits 1 when:
 * - the manual has no text layer (a scan), so nothing was checked
 * - fittings: the legend's letters and counts ("A x 66") don't pair off one to one with the guide's fittings in the box
 * - parts: a numbered part on the parts pages ("7 x4" over "573x498x16 mm") has no part of that label, size and count,
 *   or a size printed with no label near it matches no part's size
 * Fittings pair by count, so a letter's name beside it is a best guess (by spec, or CL = "Cabinet runner, left").
 * Then pairs each manual step (found by its big step number) with a guide step, in order and by their fittings, fails
 * each pair whose fittings differ (fittings not included, like wall plugs, aside), and with the dev server (QA_BASE or
 * --base) and Playwright (PLAYWRIGHT_FROM) draws each pair into .qa/manual/<slug>/pairs/NN.png: the manual's step cut
 * from its page beside the guide's step as the app shows it, zoom circles and all, for the visual pass (the manual-check
 * skill). .qa/manual/<slug>/index.html shows them all.
 * The pages are JYSK's drawings: they stay in .qa (git ignores it), never in src or public. A manual with no text layer
 * (a scan) fails, but its pages are still drawn.
 * ponytail: the legend is the page naming the most fittings, plus the page after it when that one only adds new letters,
 * and a part's label is the nearest label above its size (within 150 pt). Tried on the LIMFJORDEN, ABBETVED, BILLUND,
 * JENSLEV and TRAPPEDAL manuals; a new layout that reads wrong needs these rules taught, not skipped.
 */
import { execFile, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import { catalogSpec } from "@/lib/catalog";
import { buildPlan } from "@/lib/plan";
import type { HwType, PartItem } from "@/lib/types";
import { arg, chromiumOrNull, guideList, openRenderer, png } from "../og/browser.mjs";

const slug: string | undefined = arg("--only");
if (!slug) throw new Error("usage: npm run qa:manual -- --only <slug> [--pdf <file>]");
const spec = catalogSpec(slug);
if (!spec) throw new Error(`${slug} is not in the catalog`);
const plan = buildPlan(spec);
const out = `.qa/manual/${slug}`;
mkdirSync(out, { recursive: true });

const pdf = arg("--pdf") ?? `${out}/manual.pdf`;
if (!arg("--pdf")) {
  if (!spec.manual) throw new Error(`${slug} has no manual link: pass --pdf`);
  if (!existsSync(pdf)) {
    const r = await fetch(spec.manual);
    if (!r.ok) throw new Error(`manual: ${r.status} from ${spec.manual}`);
    writeFileSync(pdf, Buffer.from(await r.arrayBuffer()));
  }
}
const run = (cmd: string, args: string[], quiet = false) => execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 1 << 26, ...(quiet ? { stdio: ["ignore", "pipe", "ignore"] } : {}) });
const pages = Number(/Pages:\s+(\d+)/.exec(run("pdfinfo", [pdf]))?.[1]);
// the pages as pictures for the side by side, drawn while the text is read; again only when the pdf or the dpi changes
const DPI = 110;
const stamp = `${DPI} ${statSync(pdf).size} ${statSync(pdf).mtimeMs}`;
const raster =
  existsSync(`${out}/raster`) && readFileSync(`${out}/raster`, "utf8") === stamp
    ? Promise.resolve()
    : (async () => {
        for (const f of readdirSync(out)) if (f.startsWith("p-")) rmSync(`${out}/${f}`);
        await promisify(execFile)("pdftoppm", ["-r", `${DPI}`, "-gray", "-png", pdf, `${out}/p`]);
        writeFileSync(`${out}/raster`, stamp);
      })();
const layoutPages = run("pdftotext", ["-layout", pdf, "-"]).split("\f");
const layout = (p: number) => layoutPages[p - 1] ?? "";
type Word = { x: number; y: number; t: string };
type Raw = { x0: number; y0: number; w: number; h: number; t: string };
const unread: number[] = []; // pages poppler can't read
const cache = new Map<number, { words: Raw[]; height: number }>();
// every page's rows from one pdftotext call, by page; null when poppler can't get through the whole file
let whole: Map<number, string[][]> | null | undefined;
/** a page's words as poppler places them (pt from the top left), and the page's height; none where it can't read the page */
function tsv(p: number) {
  if (whole === undefined) {
    try {
      whole = new Map();
      for (const c of run("pdftotext", ["-tsv", pdf, "-"], true).split("\n").map((r) => r.split("\t"))) {
        if (!whole.has(+c[1])) whole.set(+c[1], []);
        whole.get(+c[1])!.push(c);
      }
    } catch {
      whole = null; // read page by page instead, so one bad page doesn't lose the rest
    }
  }
  if (!cache.has(p)) {
    let rows = whole?.get(p);
    if (!rows) {
      let text = "";
      try {
        text = whole ? "" : run("pdftotext", ["-f", `${p}`, "-l", `${p}`, "-tsv", pdf, "-"], true);
      } catch {
        unread.push(p);
      }
      rows = text.split("\n").map((r) => r.split("\t"));
    }
    cache.set(p, {
      words: rows.filter((c) => c[0] === "5").map((c) => ({ x0: +c[6], y0: +c[7], w: +c[8], h: +c[9], t: c[11] })),
      height: +(rows.find((c) => c[0] === "1")?.[9] ?? 842),
    });
  }
  return cache.get(p)!;
}
type Box = { x0: number; y0: number; x1: number; y1: number };
/** A page's drawing as the boxes round its strokes (pt from the top left), from poppler's SVG; none for a scan. */
function strokes(p: number): Box[] {
  let svg = "";
  try {
    svg = run("pdftocairo", ["-svg", "-f", `${p}`, "-l", `${p}`, pdf, "-"], true);
  } catch {
    return [];
  }
  const out: Box[] = [];
  for (const m of svg.slice(svg.indexOf("</defs>")).matchAll(/<path[^>]*?\sd="([^"]*)"[^>]*>/g)) {
    const tm = /transform="matrix\(([^)]*)\)"/.exec(m[0]);
    const k = tm ? tm[1].split(/[ ,]+/).filter(Boolean).map(Number) : [1, 0, 0, 1, 0, 0];
    const n = (m[1].match(/-?\d+\.?\d*(?:e-?\d+)?/g) ?? []).map(Number);
    const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let i = 0; i + 1 < n.length; i += 2) {
      const x = k[0] * n[i] + k[2] * n[i + 1] + k[4], y = k[1] * n[i] + k[3] * n[i + 1] + k[5];
      Object.assign(b, { x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) });
    }
    if (b.x0 < Infinity) out.push(b);
  }
  return out;
}

/**
 * The holes drawn in a panel on the parts pages against the guide's: a panel drawn with many more holes than the face of
 * its part with the most (a divider's rows of shelf-pin holes left out) fails. The panel is the smallest outline round
 * its label; a hole, a cluster of short strokes inside it (poppler draws each ring as many). Holes in an edge don't show
 * face on, and the face the page shows may not be the one drilled most, so only a big shortfall counts.
 * ponytail: vector parts pages only (a scan has no strokes) and labels inside their outline (a leader line's label is
 * skipped); tried on the LIMFJORDEN wardrobes, where it found the shelf-pin rows missing.
 */
/**
 * The manual's either/or: a page pointing on to two or more other pages ("31/41" and "32/41" under two layouts) offers
 * that many ways to go on, and the guide must offer as many layouts (Plan.layouts) to pick from, its choices in the
 * manual's order. One pointer is just "carry on at page n" after one of them.
 */
function eitherOr() {
  // "n/total" as the manual prints it: its total is the one it prints most (a cover may go uncounted: 31 on 32 pages)
  const marks = (p: number) => tsv(p).words.map((w) => /^(\d+)\/(\d+)$/.exec(w.t)).filter((m): m is RegExpExecArray => !!m);
  const count = (xs: number[]) => [...xs.reduce((c, x) => c.set(x, (c.get(x) ?? 0) + 1), new Map<number, number>())].sort((a, b) => b[1] - a[1]);
  const total = count(Array.from({ length: pages }, (_, i) => marks(i + 1).map((m) => +m[2])).flat())[0]?.[0];
  let k = 0; // the guide's choice for the manual's next either/or
  for (let p = 1; p <= pages; p++) {
    // pointers on: not the page's own number in its footer (a cover left uncounted shifts it by one)
    const refs = new Set(marks(p).filter((m) => +m[2] === total && +m[1] !== p && +m[1] !== p - (pages - total)).map((m) => +m[1]));
    if (refs.size < 2) continue;
    const n = plan.layouts?.[k++]?.options.length ?? 1;
    const said = `either/or on page ${p}: ${refs.size} ways on (pages ${[...refs].join(", ")}), the guide offers ${n === 1 ? "one layout" : `${n} layouts`}`;
    if (n !== refs.size) fail(said);
    else console.log(`ok   ${said}`);
  }
}

// marks the hole count reads as holes that aren't, looked at on the page: noted, not failed
const TABS = "the marks are the edge rails' folded tabs underneath (U shapes, each with its screw), not holes";
const NOT_HOLES: Record<string, string> = {
  "hallway-unit-trappedal-beige 1": TABS,
  "hallway-unit-trappedal-beige 6": TABS,
  "hallway-unit-trappedal-beige 7": TABS,
};
function holeCounts() {
  const LAB = /^(\d{1,2}[LR]?)$/;
  for (let p = 1; p <= pages; p++) {
    if (perPage[p - 1].length) continue;
    const labs = tsv(p).words.filter((w) => LAB.test(w.t) && plan.parts.some((t) => t.label === w.t));
    if (!labs.length || !tsv(p).words.some((w) => w.t === "mm")) continue;
    const all = strokes(p);
    for (const l of labs) {
      const cx = l.x0 + l.w / 2, cy = l.y0 + l.h / 2;
      const t = plan.parts.find((x) => x.label === l.t)!;
      // the panel face on: an outline round the label shaped like the part's face (not a legend's box, a page's frame or
      // a part drawn in perspective, which are skipped)
      const [a, b2] = [...t.size].sort((p, q) => q - p);
      const o = all.filter((b) => b.x1 - b.x0 > 30 && b.y1 - b.y0 > 8 && b.x0 < cx && cx < b.x1 && b.y0 < cy && cy < b.y1).sort((a, b) => (a.x1 - a.x0) * (a.y1 - a.y0) - (b.x1 - b.x0) * (b.y1 - b.y0))[0];
      const shape = o && Math.max(o.x1 - o.x0, o.y1 - o.y0) / Math.min(o.x1 - o.x0, o.y1 - o.y0) / (a / b2);
      // a panel's size is printed under it: an outline holding one is a frame round several (or the page's)
      const framed = (b: Box) => tsv(p).words.some((w) => w.t === "mm" && b.x0 < w.x0 && w.x0 + w.w < b.x1 && b.y0 < w.y0 && w.y0 + w.h < b.y1);
      if (!o || Math.abs(shape - 1) > 0.12 || framed(o)) continue;
      const bits = all.filter((b) => b.x1 - b.x0 < 4 && b.y1 - b.y0 < 4 && b.x0 > o.x0 + 0.3 && b.x1 < o.x1 - 0.3 && b.y0 > o.y0 + 0.3 && b.y1 < o.y1 - 0.3);
      const up = bits.map((_, i) => i);
      const root = (i: number): number => (up[i] === i ? i : (up[i] = root(up[i])));
      const g = 0.12;
      bits.forEach((a, i) => bits.forEach((b, j) => j < i && a.x0 - g <= b.x1 && b.x0 - g <= a.x1 && a.y0 - g <= b.y1 && b.y0 - g <= a.y1 && (up[root(i)] = root(j))));
      const holes = new Map<number, Box>();
      bits.forEach((b, i) => {
        const r = root(i), c = holes.get(r);
        holes.set(r, c ? { x0: Math.min(c.x0, b.x0), y0: Math.min(c.y0, b.y0), x1: Math.max(c.x1, b.x1), y1: Math.max(c.y1, b.y1) } : { ...b });
      });
      // round marks only: a hole in an edge shows face on as the two lines of its walls, long and thin
      const round = (c: Box) => {
        const [lo, hi] = [Math.min(c.x1 - c.x0, c.y1 - c.y0), Math.max(c.x1 - c.x0, c.y1 - c.y0)];
        return hi > 0.3 && hi < 3.5 && hi < lo * 1.6;
      };
      const drawn = [...holes.values()].filter(round).length;
      const thin = t.size.indexOf(Math.min(...t.size));
      const face = (sg: number) => Math.max(0, ...plan.items.filter((i) => i.kind === "part" && i.ref === t.id).map((i) => (i as PartItem).holes.filter((h) => h.n[thin] * sg > 0.9).length));
      const ours = Math.max(face(1), face(-1));
      const said = `holes ${t.label} ${t.name} (page ${p}): ${drawn} drawn, the guide's most drilled face has ${ours}`;
      const known = NOT_HOLES[`${slug} ${t.label}`];
      if (known) console.log(`note ${said}: ${known}`);
      else if (drawn >= 4 && ours < drawn * 0.6) {
        // the panel as the page draws it, for a look: .qa/manual/<slug>/holes-<label>.png
        const k = 200 / 72;
        run("pdftoppm", ["-f", `${p}`, "-l", `${p}`, "-r", "200", "-gray", "-png", "-singlefile", "-x", `${Math.floor((o.x0 - 6) * k)}`, "-y", `${Math.floor((o.y0 - 6) * k)}`, "-W", `${Math.ceil((o.x1 - o.x0 + 12) * k)}`, "-H", `${Math.ceil((o.y1 - o.y0 + 12) * k)}`, pdf, `${out}/holes-${t.label}`]);
        fail(`${said}: see ${out}/holes-${t.label}.png`);
      }
      else console.log(`ok   ${said}`);
    }
  }
}

const joined = new Map<number, Word[]>();
/** a page's words joined into phrases ("530 x 95 x 15 mm"), each at its centre */
function phrases(p: number): Word[] {
  if (joined.has(p)) return joined.get(p)!;
  const out: (Word & { x0: number; x1: number })[] = [];
  for (const { x0, y0, w, h, t } of tsv(p).words) {
    const last = out.at(-1);
    if (last && Math.abs(last.y - (y0 + h / 2)) < 2 && x0 - last.x1 < 6 && x0 - last.x1 > -2) Object.assign(last, { t: `${last.t} ${t}`, x1: x0 + w, x: (last.x0 + x0 + w) / 2 });
    else out.push({ x0, x1: x0 + w, x: x0 + w / 2, y: y0 + h / 2, t });
  }
  joined.set(p, out);
  return out;
}
const num = (s: string) => Number(s.replace(",", "."));

/**
 * "A x 66", "Bx7" or "F x2 4" (24, the digits printed apart) on a page, with the spec printed under each (Ø8x35 mm,
 * Ø4/46/37mm) when there is one. `bare` also reads "A    14" with no x, which some legends print.
 */
function fittings(p: number, bare = false) {
  const lines = layout(p).split("\n");
  const found: { code: string; n: number; spec?: string }[] = [];
  const re = bare ? /\b([A-Z])\s{2,}(\d+)\b/g : /\b([A-Z]{1,2})\s?x\s?(\d+(?: \d(?!\d))?)(?=\s|$)/g;
  lines.forEach((line, i) => {
    for (const m of line.matchAll(re)) {
      const col = m.index!;
      let spec: string | undefined;
      for (const below of lines.slice(i + 1, i + 8)) {
        if (below.match(re)) break;
        // decimals as "4,2" or "4.2"; \u0445 is the Cyrillic letter some legends print for x
        const specs = [...below.matchAll(/[Øh]?\d+(?:[.,]\d+)?(?:\s*[xX\u0445/]\s*\d+(?:[.,]\d+)?)*\s*mm/g)];
        if (!specs.length) continue;
        spec = specs.sort((a, b) => Math.abs(a.index! - col) - Math.abs(b.index! - col))[0][0];
        break;
      }
      found.push({ code: m[1], n: +m[2].replace(" ", ""), spec });
    }
  });
  return found;
}

const perPage = Array.from({ length: pages }, (_, i) => fittings(i + 1));
const hasText = perPage.some((f) => f.length);
let bad = 0;
const fail = (s: string) => (bad++, console.log(`FAIL ${s}`));

// ---- fittings: the legend against the guide's hardware in the box
const box = plan.hardware.filter((h) => !h.notIncluded);
const letterOf = new Map<string, string>();
const legendPages = new Set<number>();
const tools = new Set<string>(); // legend letters that are a tool (the allen key), left out of the steps' fittings
if (hasText) {
  const letters = (f: { code: string }[]) => new Set(f.map((x) => x.code)).size;
  // the page naming the most letters, read as "A x 14" or as a bare "A    14" (the first wins a tie)
  const bare = Array.from({ length: pages }, (_, i) => fittings(i + 1, true));
  const { all, i: best } = [perPage, bare].flatMap((all) => all.map((f, i) => ({ all, i, n: letters(f) }))).reduce((a, c) => (c.n > a.n ? c : a));
  const legend = [...all[best]];
  legendPages.add(best + 1);
  const next = all[best + 1] ?? [];
  if (next.length && next.every((f) => !legend.some((l) => l.code === f.code))) {
    legend.push(...next);
    legendPages.add(best + 2);
  }
  // pair each letter with a fitting of the same count, preferring one whose diameter and length the spec names
  const dims = (s = "") => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map(num);
  const fits = (l: (typeof legend)[number], h: HwType) => {
    const d = dims(l.spec);
    // runners and other lettered pairs: CL is "Cabinet runner, left"
    const initials = (h.name.match(/\b[a-z]/gi) ?? []).join("").toUpperCase();
    return (d.includes(h.dia) ? 1 : 0) + (d.includes(h.len) ? 1 : 0) + (l.code.length > 1 && initials[0] + initials.at(-1) === l.code ? 2 : 0);
  };
  const free = new Set(box);
  const surest = new Map(legend.map((l) => [l, Math.max(0, ...box.map((h) => fits(l, h)))]));
  const order = [...legend].sort((a, b) => surest.get(b)! - surest.get(a)!);
  for (const [k, l] of order.entries()) {
    // on a tie (a size that didn't read) leave the fittings a letter still to come matches by size
    const claim = (h: HwType) => Math.max(0, ...order.slice(k + 1).filter((o) => o.n === h.qty).map((o) => fits(o, h)));
    const h = [...free].filter((h) => h.qty === l.n).sort((a, b) => fits(l, b) - fits(l, a) || claim(a) - claim(b))[0];
    if (h) {
      free.delete(h);
      letterOf.set(h.id, l.code);
      console.log(`ok   ${l.code} x${l.n} ${l.spec ?? ""} = ${h.name} ${h.spec}`.trimEnd());
    } else if (l.n === 1 && !/x/i.test(l.spec ?? "x")) {
      tools.add(l.code);
      console.log(`note ${l.code} x1 ${l.spec ?? ""}: no fitting of its own (a tool?)`);
    }
    else fail(`${l.code} x${l.n} ${l.spec ?? ""}: the guide has no fitting with that count`);
  }
  for (const h of free) fail(`${h.name} ${h.spec} x${h.qty}: not in the manual's legend`);

  // ---- parts: label, size and count from the parts pages; a size with no label near it is matched by size alone
  const SIZE = /^(\d+(?:[.,]\d+)?) ?x ?(\d+(?:[.,]\d+)?) ?x ?(\d+(?:[.,]\d+)?) ?mm$/i;
  const TUBE = /^Ø(\d+(?:[.,]\d+)?) ?x ?(\d+(?:[.,]\d+)?) ?mm$/i; // a rail or pole: its diameter by its length
  const LABEL = /^(\d{1,2}[LR]?)(?: ?x ?(\d+))?$/;
  const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
  const same = (a: number[], b: number[]) => sorted(a).every((v, i) => Math.abs(v - sorted(b)[i]) <= 1);
  const seen = new Set<string>();
  let labelled = false;
  for (let p = 1; p <= pages; p++) {
    if (perPage[p - 1].length) continue; // a legend or a step: its sizes are the fittings'
    const w = phrases(p);
    const labels = w.filter((x) => LABEL.test(x.t));
    for (const s of w) {
      const m = SIZE.exec(s.t), tube = TUBE.exec(s.t);
      if (!m && !tube) continue;
      const want = (m ? m.slice(1) : [tube![1], tube![1], tube![2]]).map(num);
      const lab = labels.filter((l) => l.y < s.y && Math.hypot(l.x - s.x, l.y - s.y) < 150).sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y))[0];
      if (!lab) {
        const part = plan.parts.find((t) => !seen.has(t.id) && same(t.size, want)) ?? plan.parts.find((t) => same(t.size, want));
        if (part) {
          seen.add(part.id);
          console.log(`ok   part ${s.t} (page ${p}) = ${part.label} ${part.name}`);
        } else if (!tube) {
          const gap = (t: (typeof plan.parts)[number]) => Math.max(...sorted(t.size).map((v, i) => Math.abs(v - sorted(want)[i])));
          const near = [...plan.parts].sort((a, b) => gap(a) - gap(b))[0];
          fail(`part ${s.t} (page ${p}): no part of that size${near ? ` (nearest: ${near.label} ${near.name} ${near.size.join("x")})` : ""}`);
        }
        continue;
      }
      const [, id, n] = LABEL.exec(lab.t)!;
      const qty = Number(n ?? w.find((x) => /^x ?\d+$/.test(x.t) && Math.abs(x.x - lab.x) < 40 && Math.abs(x.y - lab.y) < 20)?.t.replace(/\D/g, "") ?? 1);
      const part = plan.parts.find((t) => t.label === id);
      // a tube that isn't its label's part is a fitting or a leg the guide keeps as hardware (or a step's callout)
      if (tube && !(part && same(part.size, want))) continue;
      if (!tube) labelled = true;
      if (part) seen.add(part.id);
      const said = `${id} ${s.t} x${qty} (page ${p})`;
      if (!part) fail(`part ${said}: no part labelled ${id}`);
      else if (!same(part.size, want)) fail(`part ${said}: the guide's is ${part.size.join("x")}`);
      else if (part.qty !== qty) fail(`part ${said}: the guide has ${part.qty}`);
      else console.log(`ok   part ${said}`);
    }
  }
  // and the other way: every part in the box is on a parts page. Where the parts pages print sizes without numbers,
  // some parts (a metal frame) often have no size printed at all, so a miss there is only a note.
  for (const t of plan.parts) {
    if (t.extra || seen.has(t.id) || !seen.size) continue;
    const said = `part ${t.label} ${t.name} ${t.size.join("x")} x${t.qty}: not found on the manual's parts pages`;
    if (labelled) fail(said);
    else console.log(`note ${said}`);
  }
  holeCounts();
  eitherOr();
  if (unread.length) console.log(`note pages ${unread.join(", ")}: pdftotext can't read them, so any parts on them weren't checked`);
} else {
  bad++;
  console.log("fail no text layer: nothing was checked (run manuals:facts first)");
}

// ---- the guide's steps, by the manual's letters
const code = (ref: string) => letterOf.get(ref) ?? plan.hardware.find((h) => h.id === ref)?.name ?? ref;
const outside = new Set(plan.hardware.filter((h) => h.notIncluded).map((h) => h.id));
// what a manual's box can show: no wall plugs or screws not included
const boxFits = plan.steps.map((s) => {
  const c = new Map<string, number>();
  for (const i of plan.items) if (i.kind === "hw" && i.step === s.n && !i.preset && !outside.has(i.ref)) c.set(code(i.ref), (c.get(code(i.ref)) ?? 0) + (s.repeat ?? 1));
  return [...c].map(([k, n]) => `${k} x${n}`);
});

// ---- the manual's steps: its big step numbers (the longest run counting up by one), each one's box running down to
// the next one on the page. A page of fittings with no number read (drawn as curves) counts as one step.
// n: the manual's own number, when read; key: its box lists the tool; bare: nothing printed but its number (a finished picture)
type MStep = { n?: number; page: number; y0: number; y1: number; fits: string[]; key?: boolean; bare?: boolean };
const marks: { page: number; n: number; y: number }[] = [];
for (let p = 1; p <= pages; p++) for (const w of tsv(p).words) if (/^\d{1,2}$/.test(w.t) && w.h >= 20 && w.x0 < 150) marks.push({ page: p, n: +w.t, y: w.y0 });
marks.sort((a, b) => a.page - b.page || a.y - b.y);
// each mark extends the longest run so far that ends one lower
const ends = new Map<number, { len: number; i: number }>(), prev: number[] = [];
let top = { len: 0, i: -1 };
marks.forEach((m, i) => {
  const before = ends.get(m.n - 1);
  const here = { len: (before?.len ?? 0) + 1, i };
  prev[i] = before?.i ?? -1;
  if (here.len > (ends.get(m.n)?.len ?? 0)) ends.set(m.n, here);
  if (here.len > top.len) top = here;
});
// a lone number is no run of steps (a stray digit on pages drawn as curves): the pages the family names win
if (top.len < 2 && plan.steps.some((s) => s.page)) top = { len: 0, i: -1 };
const mine: typeof marks = [];
for (let i = top.i; i >= 0; i = prev[i]) mine.unshift(marks[i]);
const fitsIn = (page: number, y0: number, y1: number) =>
  phrases(page)
    .filter((w) => w.y > y0 && w.y < y1)
    .flatMap((w) => {
      const f = /^([A-Z]{1,2}) ?x ?(\d+(?: \d)?)$/.exec(w.t);
      return f && !tools.has(f[1]) ? [`${f[1]} x${f[2].replace(" ", "")}`] : [];
    });
const msteps: MStep[] = mine.map((m, i) => {
  const next = mine[i + 1]?.page === m.page ? mine[i + 1].y : tsv(m.page).height - 50;
  const [y0, y1] = [m.y - 25, next - 25]; // a step's fitting box starts a little above its number
  // the box's tool letter (the allen key, "D x 1") shows only in the steps that need it
  const key = phrases(m.page).some((w) => w.y > y0 && w.y < y1 && tools.has(/^([A-Z]{1,2}) ?x ?1$/.exec(w.t)?.[1] ?? ""));
  // the page's foot (the page number, JYSK's address) aside
  const bare = !phrases(m.page).some((w) => w.y > y0 && w.y < Math.min(y1, tsv(m.page).height - 120) && w.t !== `${m.n}`);
  return { n: m.n, page: m.page, y0, y1, fits: fitsIn(m.page, y0, y1), key, bare };
});
for (let p = 1; p <= pages; p++) {
  if (!perPage[p - 1].length || legendPages.has(p) || mine.some((m) => m.page === p)) continue;
  msteps.push({ page: p, y0: 0, y1: tsv(p).height - 50, fits: fitsIn(p, 0, tsv(p).height) });
}
msteps.sort((a, b) => a.page - b.page || a.y0 - b.y0);

// ---- which manual step is which guide step: lined up in order, steps with the same fittings drawn together
const like = (a: string[], b: string[]) => {
  if (!a.length && !b.length) return 1;
  if (!a.length || !b.length) return -0.5;
  const both = a.filter((x) => b.includes(x)).length;
  // a fitting named differently but in the same count (a letter the legend didn't pair) counts a third
  const counts = (l: string[], o: string[]) => l.filter((x) => !o.includes(x)).map((x) => x.slice(x.lastIndexOf("x")));
  const rest = counts(b, a);
  const near = counts(a, b).filter((c) => rest.includes(c) && rest.splice(rest.indexOf(c), 1)).length;
  return (3 * both + near) / new Set([...a, ...b]).size - 1;
};
// a step left alone costs GAP, and a run of manual steps the guide leaves out (another build or layout) costs OPEN once
// more, so such a block stays one block. Not so for guide steps: a page of unnumbered manual steps is one manual step.
const GAP = -0.6, OPEN = -1, NO = -1e9;
const M = msteps.length, G = plan.steps.length;
// T[i][j][k]: the best score for the first i manual and j guide steps, ending in a pair (k 0), a manual step alone (1)
// or a guide step alone (2); back[k]: how far that move steps back
const back = [[1, 1], [1, 0], [0, 1]];
// a guide's choosing step (Plan.layouts) is the manual's either/or page, which has no step of its own: it stands alone, free
const chooser = new Set(plan.layouts?.map((c) => c.step));
const gain = (k: number, f: number, i: number, j: number) =>
  chooser.has(j - 1) ? (k === 2 ? 0 : k === 0 ? NO : GAP + (f !== 1 ? OPEN : 0)) : k ? GAP + (k === 1 && f !== 1 ? OPEN : 0) : like(msteps[i - 1].fits, boxFits[j - 1]);
const T = Array.from({ length: M + 1 }, () => Array.from({ length: G + 1 }, () => [NO, NO, NO]));
T[0][0][0] = 0;
for (let i = 0; i <= M; i++)
  for (let j = 0; j <= G; j++)
    for (const [k, [di, dj]] of back.entries()) if (i >= di && j >= dj && (i || j)) T[i][j][k] = Math.max(...T[i - di][j - dj].map((s, f) => s + gain(k, f, i, j)));
// the first of the best (a pair, then a manual step alone), scores within a rounding error
const pick = (c: number[]) => c.reduce((b, s, f) => (s > c[b] + 1e-9 ? f : b), 0);
const pairs: { m?: MStep; g?: number }[] = [];
// a last manual step showing only the finished piece is left out when that lines the rest up better
let i = M, j = G;
if (msteps.at(-1)?.bare && M && Math.max(...T[M - 1][G]) > Math.max(...T[M][G]) + 1e-9) pairs.push({ m: msteps[--i] });
// walking back from the end, a pair first on a tie (as before: of two equal layouts, the later one)
for (let k = pick(T[i][j]); i || j; ) {
  const [di, dj] = back[k];
  pairs.unshift(k === 0 ? { m: msteps[i - 1], g: j - 1 } : k === 1 ? { m: msteps[i - 1] } : { g: j - 1 });
  k = pick(T[i - di][j - dj].map((s, f) => s + gain(k, f, i, j)));
  [i, j] = [i - di, j - dj];
}
const label = (p: (typeof pairs)[number]) =>
  `${p.m ? `manual ${p.m.n ? `step ${p.m.n} ` : ""}(p${p.m.page})` : "no manual step"} | ${p.g !== undefined ? `guide ${p.g + 1}. ${plan.steps[p.g].title}` : p.m?.bare && p.m === msteps.at(-1) ? "the finished piece" : "no guide step"}`;
console.log(`\nsteps, manual beside guide${msteps.length ? "" : " (no step numbers read: the manual's pages in order instead)"}:`);
for (const p of pairs) {
  const a = p.m?.fits ?? [], b = p.g !== undefined ? boxFits[p.g] : [];
  const differ = [...a.filter((x) => !b.includes(x)), ...b.filter((x) => !a.includes(x))];
  if (differ.length) bad++;
  // ponytail: the one lettered tool JYSK boxes hold is the allen key
  const allen = p.g !== undefined && plan.steps[p.g].tools.includes("allen");
  const key = p.m?.n && p.g !== undefined && tools.size && p.m.key !== allen ? `   allen key: manual ${p.m.key ? "yes" : "no"}, guide ${allen ? "yes" : "no"}` : "";
  console.log(`  ${label(p)}${differ.length ? `   fittings differ: manual ${a.join(", ") || "-"}, guide ${b.join(", ") || "-"}` : ""}${key}`);
}

// ---- the side by side: each manual step cut from its page beside the guide's step as the app shows it, zoom circles
// and all, in .qa/manual/<slug>/pairs/NN.png for the visual pass. Needs the dev server and Playwright (as qa:snapshots).
await raster;
const pageFile = new Map(readdirSync(out).filter((f) => /^p-\d+\.png$/.test(f)).map((f) => [Number(/\d+/.exec(f)![0]), f]));
// no step numbers read (no text layer): each guide step beside the page its family names, else the pages alone
const pageStep = (page: number): MStep => ({ page, y0: 0, y1: tsv(page).height, fits: [] });
const rows: typeof pairs = msteps.length
  ? pairs
  : plan.steps.some((s) => s.page)
    ? plan.steps.map((s, g) => (s.page ? { m: pageStep(s.page), g } : { g }))
    : [...pageFile.keys()].map((page) => ({ m: pageStep(page) }));
if (!msteps.length && !plan.steps.some((s) => s.page)) console.log("note no step numbers read and the family names no manual pages (StepDef page): the pairs show the manual only");
// started only now: the reading above is synchronous and would starve the dev server check's timeout
const base = arg("--base", process.env.QA_BASE ?? "http://localhost:3000");
const live = chromiumOrNull() && (await guideList(base)) ? await openRenderer(base) : null;
if (!live) console.log(`note no dev server with /dev/og at ${base} or no Playwright (PLAYWRIGHT_FROM): the pairs show the manual only`);
const pairDir = `${out}/pairs`;
// without a browser the last run's pictures stay
if (live) rmSync(pairDir, { recursive: true, force: true });
mkdirSync(pairDir, { recursive: true });
const SW = 900, SH = 650;
if (live) await live.page.setViewportSize({ width: SW + 50, height: SH + 50 });
const files: string[] = [];
const sent = new Set<number>(); // pages whose picture the browser already holds
for (const [i, p] of (live ? rows : []).entries()) {
  let shot: string | null = null;
  if (p.g !== undefined) {
    // resolves once the step has settled, zoom circles in
    await live!.page.evaluate(([s, w, h, k]: [string, number, number, number]) => window.__live!(s, w, h, k), [slug, SW, SH, p.g]);
    shot = "data:image/png;base64," + (await live!.page.locator("#live").screenshot()).toString("base64");
  }
  const f = p.m && pageFile.get(p.m.page);
  // the page picture goes over once, then the browser keeps it by page number
  const url = f && !sent.has(p.m!.page) ? "data:image/png;base64," + readFileSync(`${out}/${f}`).toString("base64") : null;
  if (f) sent.add(p.m!.page);
  const pg = f ? { page: p.m!.page, url, y0: p.m!.y0, y1: p.m!.y1, height: tsv(p.m!.page).height } : null; // pt, from the top
  const picture = await live!.page.evaluate(
    async ({ pg, shot, title, SH }: { pg: { page: number; url: string | null; y0: number; y1: number; height: number } | null; shot: string | null; title: string; SH: number }) => {
      const load = (src: string) => new Promise<HTMLImageElement>((r, no) => Object.assign(new Image(), { onload(this: HTMLImageElement) { r(this); }, onerror: () => no(new Error("a picture didn't load")), src }));
      const pages = ((window as unknown as { __pages?: Map<number, Promise<HTMLImageElement>> }).__pages ??= new Map());
      if (pg?.url) pages.set(pg.page, load(pg.url));
      const [a, b] = await Promise.all([pg ? pages.get(pg.page)! : null, shot ? load(shot) : null]);
      const k = a ? a.height / pg!.height : 0, y = a ? pg!.y0 * k : 0, h = a ? (pg!.y1 - pg!.y0) * k : 1;
      const aw = a ? Math.min((a.width * SH) / h, a.width * 2) : 0;
      const c = Object.assign(document.createElement("canvas"), { width: Math.round(aw + (b ? b.width : 0)) || 10, height: SH + 30 });
      const x = c.getContext("2d")!;
      x.fillStyle = "#fff";
      x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = "#000";
      x.font = "16px system-ui";
      x.fillText(title, 8, 20);
      if (a) x.drawImage(a, 0, y, a.width, h, 0, 30, aw, (h * aw) / a.width);
      if (b) x.drawImage(b, aw, 30, b.width, SH);
      return c.toDataURL("image/png");
    },
    { pg, shot, title: label(p), SH },
  );
  const name = `${String(i + 1).padStart(2, "0")}.png`;
  writeFileSync(`${pairDir}/${name}`, png(picture));
  files.push(name);
}
await live?.browser.close();
writeFileSync(
  `${out}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>${slug}: manual</title><style>body{margin:0;padding:8px;font:13px system-ui}img{max-width:100%;border:1px solid #ccc;display:block;margin-bottom:16px}</style>` +
    (files.length
      ? files.map((f) => `<img loading="lazy" src="pairs/${f}">`).join("")
      : [...pageFile.values()].map((f) => `<p>${f}</p><img loading="lazy" src="${f}">`).join("")),
);
console.log(`\n${bad ? `${bad} problem${bad > 1 ? "s" : ""}` : "no problems"}; side by side: ${out}/index.html${files.length ? `, one picture a step in ${pairDir}` : ""}`);
if (bad) process.exit(1);
