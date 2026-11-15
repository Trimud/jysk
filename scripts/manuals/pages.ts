/**
 * Fetches each product's manual and draws its pages: npm run manuals:pages -- --only a,b
 * Prints slug, page count and whether the manual has a text layer; files go to .qa/manuals/<slug>/ (see pdf.ts).
 */
import { arg } from "../og/browser.mjs";
import { fetchManual } from "./pdf";

const only: string | undefined = arg("--only");
if (!only) throw new Error("usage: npm run manuals:pages -- --only a,b");
let bad = 0;
for (const slug of only.split(",").map((s) => s.trim()).filter(Boolean)) {
  try {
    const m = await fetchManual(slug);
    if (!m) {
      bad++;
      console.log(`${slug}\tno manual link (or not in the catalog)`);
    } else console.log(`${slug}\tpages ${m.pages.length}\ttext ${m.text}\t${m.dir}`);
  } catch (e) {
    bad++;
    console.log(`${slug}\tfailed: ${(e as Error).message}`);
  }
}
if (bad) process.exitCode = 1;
