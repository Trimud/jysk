/**
 * Checks where each step's zoom circles land in a guide's live view, at a desktop and a phone size:
 *
 *   npm run dev, then npm run qa:callouts -- [--family LIMFJORDEN] [--only a,b] [--base URL]
 *
 * Every circle must sit inside the view, clear of the step number and fittings box (top left) and the buttons along
 * the bottom, clear of the other circles, and not over any fitting of the step (Stage.placeCallouts aims for this;
 * here it is checked on every step of every guide). Writes .qa/callouts.json and exits 1 when anything breaks a rule.
 * Needs the dev server (QA_BASE if it isn't on port 3000) and Playwright (PLAYWRIGHT_FROM, see scripts/og/browser.mjs).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, guideList, openRenderer } from "../og/browser.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
// the guide's drawing on a laptop, and roughly on a phone (above the step's text)
const SIZES = [{ name: "desktop", w: 930, h: 740 }, { name: "phone", w: 390, h: 480 }];
const base = arg("--base", process.env.QA_BASE ?? "http://localhost:3000");
const only = arg("--only")?.split(",").filter(Boolean);
const family = arg("--family")?.toUpperCase().split(",");

const list = await guideList(base);
if (!list) throw new Error("start the dev server first (npm run dev), or pass --base");
const slugs = list.filter((j) => j.slug && (only ? only.includes(j.slug) : !family || family.includes(j.family))).map((j) => j.slug);

/** What a layout breaks, as short readable reasons. */
function problems(l) {
  const out = [];
  const { r } = l;
  l.circles.forEach((c, i) => {
    const n = `circle ${i + 1}`;
    if (c.x - r < 0 || c.x + r > l.w || c.y - r < 0) out.push(`${n} is out of the view`);
    if (c.y + r > l.bar) out.push(`${n} covers the buttons along the bottom`);
    const qx = Math.min(Math.max(c.x, 0), l.box.w), qy = Math.min(Math.max(c.y, 0), l.box.h);
    if (Math.hypot(c.x - qx, c.y - qy) < r) out.push(`${n} covers the step number or fittings box`);
    l.circles.forEach((o, j) => j > i && Math.hypot(c.x - o.x, c.y - o.y) < 2 * r && out.push(`${n} overlaps circle ${j + 1}`));
    const under = l.fits.filter((f) => Math.hypot(c.x - f.x, c.y - f.y) < r).length;
    if (under) out.push(`${n} covers ${under} fitting${under > 1 ? "s" : ""}`);
  });
  return out;
}

const { browser, page } = await openRenderer(base);
const found = [];
let steps = 0, done = 0;
for (const slug of slugs) {
  for (const size of SIZES) {
    const layouts = await page.evaluate(({ slug, w, h }) => window.__callouts(slug, w, h), { slug, w: size.w, h: size.h }).catch((e) => {
      found.push({ slug, size: size.name, step: 0, problems: [`failed: ${e.message.split("\n")[0]}`] });
      return [];
    });
    (layouts ?? []).forEach((l, k) => {
      if (!l) return;
      steps++;
      const p = problems(l);
      if (p.length) found.push({ slug, size: size.name, step: k + 1, problems: p });
    });
  }
  if (++done % 25 === 0) console.log(`${done}/${slugs.length}`);
}
await browser.close();

mkdirSync(path.join(ROOT, ".qa"), { recursive: true });
writeFileSync(path.join(ROOT, ".qa", "callouts.json"), JSON.stringify(found, null, 2));
for (const f of found.slice(0, 40)) console.log(`${f.slug} step ${f.step} (${f.size}): ${f.problems.join("; ")}`);
if (found.length > 40) console.log(`... and ${found.length - 40} more in .qa/callouts.json`);
console.log(`${found.length} of ${steps} step views with circles break a rule, over ${slugs.length} guide${slugs.length === 1 ? "" : "s"}`);
if (found.length) process.exit(1);
