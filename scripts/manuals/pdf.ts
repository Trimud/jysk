/**
 * A product's assembly manual, fetched once into .qa/manuals/<slug>/manual.pdf and its pages drawn as p-NN.png (gray,
 * long side 1568 px) for a reader to look at. The pages are JYSK's drawings: they stay in .qa (git ignores it), never
 * in src or public.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { catalogSpec } from "@/lib/catalog";

const LONG = 1568;

/** fetches url into file, once: an existing file is kept */
export async function download(url: string, file: string) {
  if (existsSync(file)) return;
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`manual: ${r.status} from ${url}`);
  const body = Buffer.from(await r.arrayBuffer());
  // a 200 carrying an error or consent page would be kept forever as the manual: only a pdf is written
  if (body.subarray(0, 5).toString("latin1") !== "%PDF-") throw new Error(`manual: not a pdf (${r.headers.get("content-type") ?? "no content type"}) from ${url}`);
  writeFileSync(file, body);
}

/** the manual and its pages; null when the product has no manual link (or isn't in the catalog) */
export async function fetchManual(slug: string): Promise<{ dir: string; pdf: string; pages: string[]; text: boolean } | null> {
  const spec = catalogSpec(slug);
  if (!spec?.manual) return null;
  const dir = `.qa/manuals/${slug}`;
  const pdf = `${dir}/manual.pdf`;
  mkdirSync(dir, { recursive: true });
  await download(spec.manual, pdf);
  // drawn again only when the pdf or the size changes (the stamp is written last, so a broken run draws again)
  const st = statSync(pdf);
  const stamp = `${LONG} ${st.size} ${st.mtimeMs}`;
  if (!existsSync(`${dir}/raster`) || readFileSync(`${dir}/raster`, "utf8") !== stamp) {
    for (const f of readdirSync(dir)) if (f.startsWith("p-")) rmSync(`${dir}/${f}`);
    execFileSync("pdftoppm", ["-scale-to", `${LONG}`, "-gray", "-png", pdf, `${dir}/p`]);
    // pdftoppm pads page numbers to the page count's width (p-1 under 10 pages): always two digits
    for (const f of readdirSync(dir)) {
      const n = /^p-(\d+)\.png$/.exec(f)?.[1];
      if (n && n.length < 2) renameSync(`${dir}/${f}`, `${dir}/p-${n.padStart(2, "0")}.png`);
    }
    writeFileSync(`${dir}/raster`, stamp);
  }
  const pages = readdirSync(dir)
    .filter((f) => /^p-\d+\.png$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))
    .map((f) => `${dir}/${f}`);
  let words = "";
  try {
    words = execFileSync("pdftotext", [pdf, "-"], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") throw e; // no poppler: not a manual without text
    words = String((e as { stdout?: string }).stdout ?? ""); // a page poppler can't read: the text it got before it
  }
  // ponytail: whitespace and page breaks aside, so a scan's empty pages don't count as text
  return { dir, pdf, pages, text: words.replace(/\s/g, "").length > 200 };
}
