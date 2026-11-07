/**
 * Draws the pictures the share cards use, with the app's own engine:
 *
 *   npm run dev, then: node scripts/og/render.mjs [--base http://localhost:3000] [--only kallax-2x2] [--missing] [--if-available]
 *
 * Needs Playwright from any project that has it: PLAYWRIGHT_FROM=/path/to/project.
 * Writes public/og/{slug}.png for every catalog product and public/og/kind-{kind}.png
 * for every furniture kind (the fallback for everything else). --if-available exits quietly without the dev server,
 * Playwright or ffmpeg, so npm run jysk:build can always call it (with --missing: pictures for new guides).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { arg, chromiumOrNull, guideList, openRenderer, png } from "./browser.mjs";

const args = process.argv.slice(2);
const base = arg("--base", process.env.QA_BASE ?? "http://localhost:3000");
if (args.includes("--if-available")) {
  const skip = (why) => {
    console.log(`og pictures skipped: ${why}`);
    process.exit(0);
  };
  if (!chromiumOrNull()) skip("no Playwright (set PLAYWRIGHT_FROM to a folder whose node_modules has it)");
  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    skip("no ffmpeg");
  }
  if (!(await guideList(base))) skip(`no dev server at ${base}`);
}
const only = arg("--only");

const OUT = path.resolve(import.meta.dirname, "../../public/og");
mkdirSync(OUT, { recursive: true });

const { browser, page } = await openRenderer(base);

// --step malm-3-drawers:6:malm-step draws one step of a product instead of the whole list
const step = arg("--step");
const jobs = step
  ? [{ slug: step.split(":")[0], mode: { kind: "step", index: Number(step.split(":")[1]) }, out: step.split(":")[2] }]
  : await page.evaluate(() => fetch("/dev/og/list").then((r) => r.json()));
const missing = args.includes("--missing");
const name = (j) => j.out ?? j.slug ?? "kind-" + j.kind;
const list = (only ? jobs.filter((j) => j.slug === only || j.kind === only) : jobs).filter((j) => !missing || !existsSync(path.join(OUT, `${name(j)}.png`)));
let n = 0;
const failed = [];
for (const j of list) {
  // one plan that fails to draw shouldn't stop the rest
  const url = await page.evaluate((o) => window.__draw(o), { ...j, w: 640, h: 560 }).catch((e) => void failed.push(`${name(j)}: ${e.message.split("\n")[0]}`));
  if (!url) continue;
  const file = path.join(OUT, `${name(j)}.png`);
  writeFileSync(file, png(url));
  // flatten onto pure white and keep 48 colours: line art stays crisp at a sixth of the size
  const tmp = file + ".tmp.png";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", file, "-filter_complex", "color=white:s=1280x1120,format=rgba[bg];[bg][0:v]overlay=shortest=1,scale=720:-1:flags=lanczos,format=rgb24,lutrgb=r='if(gt(val\\,246)\\,255\\,val)':g='if(gt(val\\,246)\\,255\\,val)':b='if(gt(val\\,246)\\,255\\,val)',split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse=dither=none", "-frames:v", "1", tmp]);
  renameSync(tmp, file);
  if (++n % 20 === 0) console.log(`${n}/${list.length}`);
}
console.log(`drew ${n} pictures into public/og`);
if (failed.length) console.log(`couldn't draw ${failed.length}:\n  ${failed.join("\n  ")}`);
await browser.close();
