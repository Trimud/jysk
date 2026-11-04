/**
 * Draws every view of a guide and compares it with the last approved drawing:
 *
 *   npm run dev, then npm run qa:snapshots -- [--changed] [--only a,b] [--family LIMFJORDEN] [--all] [--base URL]
 *   npm run qa:snapshots -- --approve [--only a,b]     keeps the current drawings as the reference
 *
 * The views: the finished piece, everything opened (when something opens), X-ray, and every step. Each is written to
 * .qa/current/<slug>/<view>.png and compared, in the browser, with .qa/baseline/<slug>/<view>.png; .qa/report.html
 * lists what changed (reference, new, difference), what is new and what is gone. With no selection it draws the guides
 * whose family file or catalog row changed since the last commit (--changed). Exits 1 when anything changed or is new,
 * until it is approved. Needs the dev server (QA_BASE if it isn't on port 3000) and Playwright (PLAYWRIGHT_FROM, see
 * scripts/og/browser.mjs); --if-available exits quietly when either is missing, so npm run jysk:build can always call it.
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { decodeRows } from "@/lib/ikea";
import { familyOf } from "@/lib/plan/families/family";
import { arg, chromiumOrNull, openRenderer, png } from "../og/browser.mjs";

const args = process.argv.slice(2);
const ROOT = path.resolve(import.meta.dirname, "../..");
const QA = path.join(ROOT, ".qa");
const CUR = path.join(QA, "current"), BASE = path.join(QA, "baseline"), DIFF = path.join(QA, "diff");
const W = 400, H = 300;
const MIN_CHANGED = 20; // pixels that differ before a view counts as changed: anti-aliasing noise stays under it
const only = arg("--only")?.split(",").filter(Boolean);
const family = arg("--family");
const soft = args.includes("--if-available");
const quiet = (msg) => {
  console.log(`qa:snapshots skipped: ${msg}`);
  process.exit(0);
};

/* ---------- approve: the current drawings become the reference ---------- */
if (args.includes("--approve")) {
  if (!existsSync(CUR)) quiet("nothing drawn yet");
  const slugs = only ?? readdirSync(CUR);
  for (const s of slugs) {
    if (!existsSync(path.join(CUR, s))) continue;
    rmSync(path.join(BASE, s), { recursive: true, force: true });
    cpSync(path.join(CUR, s), path.join(BASE, s), { recursive: true });
  }
  console.log(`approved ${slugs.length} guide${slugs.length === 1 ? "" : "s"}`);
  process.exit(0);
}

/* ---------- the browser ---------- */
const base = arg("--base", process.env.QA_BASE ?? "http://localhost:3000");
if (!chromiumOrNull()) {
  if (soft) quiet("no Playwright (set PLAYWRIGHT_FROM to a folder whose node_modules has it)");
  throw new Error("set PLAYWRIGHT_FROM to a folder whose node_modules has playwright");
}
const list = await fetch(`${base}/dev/og/list`, { signal: AbortSignal.timeout(5000) }).then((r) => r.json(), () => null);
if (!list) {
  if (soft) quiet(`no dev server at ${base}`);
  throw new Error("start the dev server first (npm run dev), or pass --base");
}
const familyOfSlug = new Map(list.filter((j) => j.slug).map((j) => [j.slug, j.family]));

/* ---------- which guides ---------- */
const git = (...a) => execFileSync("git", a, { cwd: ROOT, encoding: "utf8" });

/** The families whose file or catalog rows changed since the last commit, or "all" when shared code changed. */
function changedFamilies() {
  const files = [...git("diff", "--name-only", "HEAD").split("\n"), ...git("ls-files", "--others", "--exclude-standard", "src").split("\n")].filter(Boolean);
  const fams = new Set();
  for (const f of files) {
    const fam = f.match(/^src\/lib\/plan\/families\/([a-z0-9]+)[a-z0-9-]*\.ts$/);
    if (fam && !["index", "family"].includes(fam[1])) {
      fams.add(fam[1].toUpperCase());
    } else if (f === "src/data/jysk-rows.ts") {
      // the rows added or removed, read the way the app reads them (the first sits after the opening backtick)
      const rows = git("diff", "-U0", "HEAD", "--", f).split("\n").filter((l) => /^[+-][^+-]/.test(l)).map((l) => l.slice(1).replace(/^.*`/, ""));
      for (const r of decodeRows(rows.join("\n"))) fams.add(familyOf(r));
    } else if (/^src\/(lib\/plan|engine|lib\/types\.ts)/.test(f)) {
      return "all";
    }
  }
  return fams;
}

let slugs;
if (only) slugs = only;
else if (args.includes("--all")) slugs = [...familyOfSlug.keys()];
else {
  const fams = family ? new Set(family.toUpperCase().split(",")) : changedFamilies();
  if (fams === "all") console.log("shared plan or engine code changed: drawing every guide (this takes a while; narrow it with --family or --only)");
  slugs = [...familyOfSlug].filter(([, f]) => fams === "all" || fams.has(f)).map(([s]) => s);
}
if (!slugs.length) quiet(family ? "no guide in that family" : "no family or catalog row changed since the last commit");

/* ---------- draw and compare, in the page ---------- */
const { browser, page } = await openRenderer(base);
const views = (i) => [
  { name: "finished", mode: { kind: "assembled" } },
  ...(i.opens ? [{ name: "open", mode: { kind: "assembled" }, look: { open: true } }] : []),
  { name: "xray", mode: { kind: "assembled" }, look: { xray: true } },
  ...Array.from({ length: i.steps }, (_, k) => ({ name: `step-${String(k + 1).padStart(2, "0")}`, mode: { kind: "step", index: k } })),
];
/** Draws one view; with a reference, compares the two and draws the difference (changed pixels in red over a faint copy). */
const drawAndCompare = (o) =>
  page.evaluate(async ({ ref, min, ...o }) => {
    const url = await window.__draw(o);
    if (!url || !ref) return { url };
    const load = (src) => new Promise((r, e) => Object.assign(new Image(), { onload() { r(this); }, onerror: e, src }));
    const [A, B] = await Promise.all([load(ref), load(url)]);
    if (A.width !== B.width || A.height !== B.height) return { url, changed: Infinity, diff: null };
    const c = Object.assign(document.createElement("canvas"), { width: A.width, height: A.height });
    const x = c.getContext("2d", { willReadFrequently: true });
    x.drawImage(A, 0, 0);
    const da = x.getImageData(0, 0, c.width, c.height).data;
    x.clearRect(0, 0, c.width, c.height);
    x.drawImage(B, 0, 0);
    const db = x.getImageData(0, 0, c.width, c.height).data;
    const out = x.createImageData(c.width, c.height);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]), Math.abs(da[i + 3] - db[i + 3]));
      if (d > 32) {
        n++;
        out.data.set([230, 30, 30, 255], i);
      } else out.data.set([db[i], db[i + 1], db[i + 2], Math.round(db[i + 3] * 0.25)], i);
    }
    if (n < min) return { url, changed: n, diff: null };
    x.putImageData(out, 0, 0);
    return { url, changed: n, diff: c.toDataURL("image/png") };
  }, { ...o, min: MIN_CHANGED });

rmSync(DIFF, { recursive: true, force: true });
const result = { changed: [], fresh: [], gone: [], failed: [], same: 0 };
let done = 0;
for (const slug of slugs) {
  const i = await page.evaluate((s) => window.__info(s), slug);
  if (!i) {
    result.failed.push(`${slug}: not in the catalog`);
    continue;
  }
  rmSync(path.join(CUR, slug), { recursive: true, force: true });
  mkdirSync(path.join(CUR, slug), { recursive: true });
  const names = new Set();
  for (const v of views(i)) {
    names.add(v.name);
    const refFile = path.join(BASE, slug, `${v.name}.png`);
    const ref = existsSync(refFile) ? "data:image/png;base64," + readFileSync(refFile).toString("base64") : null;
    const r = await drawAndCompare({ slug, mode: v.mode, look: v.look, w: W, h: H, ref }).catch((e) => void result.failed.push(`${slug} ${v.name}: ${e.message.split("\n")[0]}`));
    if (!r?.url) continue;
    writeFileSync(path.join(CUR, slug, `${v.name}.png`), png(r.url));
    if (!ref) result.fresh.push({ slug, view: v.name });
    else if (r.changed < MIN_CHANGED) result.same++;
    else {
      // a drawing whose size changed has no difference image, only the two drawings
      if (r.diff) {
        mkdirSync(path.join(DIFF, slug), { recursive: true });
        writeFileSync(path.join(DIFF, slug, `${v.name}.png`), png(r.diff));
      }
      result.changed.push({ slug, view: v.name, pixels: r.changed });
    }
  }
  if (existsSync(path.join(BASE, slug))) for (const f of readdirSync(path.join(BASE, slug))) if (!names.has(f.replace(/\.png$/, ""))) result.gone.push({ slug, view: f.replace(/\.png$/, "") });
  if (++done % 10 === 0) console.log(`${done}/${slugs.length}`);
}
await browser.close();

/* ---------- the report ---------- */
const summary = `${result.changed.length} changed, ${result.fresh.length} new, ${result.gone.length} gone, ${result.same} unchanged, ${result.failed.length} failed`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const img = (dir, slug, view) => `<img loading="lazy" src="${dir}/${esc(slug)}/${esc(view)}.png" alt="">`;
const fig = (dir, c, caption) => `<figure>${img(dir, c.slug, c.view)}<figcaption>${caption}</figcaption></figure>`;
const toApprove = [...new Set([...result.changed, ...result.fresh].map((x) => x.slug))].join(",") || "slug";
const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QA snapshots</title>
<style>
body{font:14px/1.4 system-ui,sans-serif;margin:24px;color:#1b2430;background:#f6f7f9}
h1{font-size:20px}h2{font-size:16px;margin-top:32px}code{background:#e9ecf1;padding:1px 4px;border-radius:3px}
.row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0 20px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px}
figure{margin:0;background:#fff;border:1px solid #dde2e8;border-radius:6px;padding:6px}figcaption{font-size:12px;color:#5b6675}img{width:100%;display:block}
</style>
<h1>QA snapshots</h1>
<p>${summary}, over ${slugs.length} guide${slugs.length === 1 ? "" : "s"}. Keep what's right with <code>npm run qa:snapshots -- --approve --only ${esc(toApprove)}</code>.</p>
${result.changed.length ? "<h2>Changed: reference, new, difference in red</h2>" : ""}
${result.changed.map((c) => `<h3>${esc(c.slug)} &middot; ${esc(c.view)} <small>(${c.pixels === Infinity ? "a different size" : `${c.pixels} pixels`})</small></h3><div class="row">${fig("baseline", c, "reference")}${fig("current", c, "new")}${c.pixels === Infinity ? "" : fig("diff", c, "difference")}</div>`).join("\n")}
${result.fresh.length ? `<h2>New: no reference yet</h2><div class="grid">${result.fresh.map((c) => fig("current", c, `${esc(c.slug)} &middot; ${esc(c.view)}`)).join("")}</div>` : ""}
${result.gone.length ? `<h2>Gone: in the reference, not drawn any more</h2><ul>${result.gone.map((c) => `<li>${esc(c.slug)} &middot; ${esc(c.view)}</li>`).join("")}</ul>` : ""}
${result.failed.length ? `<h2>Failed to draw</h2><ul>${result.failed.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}`;
writeFileSync(path.join(QA, "report.html"), html);
console.log(`${summary}: open .qa/report.html`);
if (result.changed.length || result.fresh.length || result.gone.length || result.failed.length) process.exit(soft ? 0 : 1);
