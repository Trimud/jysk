/**
 * The headless browser both drawing scripts share (scripts/og/render.mjs, scripts/qa/snapshots.mjs): Playwright from
 * PLAYWRIGHT_FROM (or this project), SwiftShader so drawings come out the same every run, and the dev page that
 * draws with the app's own engine.
 */
import { createRequire } from "node:module";
import path from "node:path";

/** `--key value` from the command line, or `d`. */
export const arg = (k, d) => {
  const a = process.argv.slice(2);
  return a.includes(k) ? a[a.indexOf(k) + 1] : d;
};

/** A data URL's bytes. */
export const png = (url) => Buffer.from(url.split(",")[1], "base64");

/** Playwright's chromium, or null when it can't be found. */
export function chromiumOrNull() {
  try {
    const from = process.env.PLAYWRIGHT_FROM ?? path.resolve(import.meta.dirname, "../..");
    return createRequire(path.join(from, "package.json"))("playwright").chromium;
  } catch {
    return null;
  }
}

/** A browser on `${base}/dev/og`, ready to draw. A dev server that has just recompiled can leave the first load hanging, so it tries twice. */
export async function openRenderer(base) {
  const chromium = chromiumOrNull();
  if (!chromium) throw new Error("set PLAYWRIGHT_FROM to a folder whose node_modules has playwright");
  const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage();
  for (let tries = 2; tries--; ) {
    await page.goto(`${base}/dev/og`);
    const ok = await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 60_000 }).then(() => true, () => false);
    if (ok) return { browser, page };
  }
  await browser.close();
  throw new Error(`${base}/dev/og never got ready: is the dev server running and compiled?`);
}
