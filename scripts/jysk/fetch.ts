// Fetches the JYSK UK product pages listed in pilot.txt and keeps only facts: npm run jysk:fetch
// Each page is downloaded once, 2 s apart, into scripts/jysk/cache (git ignored); later runs read the cache.
// Out: scripts/jysk/facts.json (git ignored). No images, prices, descriptions or reviews are kept.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const DIR = import.meta.dirname;
const CACHE = path.join(DIR, "cache");
const UA = "MontaCatalog/0.1 (+https://monta.online)";

export interface Facts {
  url: string;
  slug: string; // the page's own slug, kept as the guide's slug
  family: string; // JSON-LD ProductGroup.productGroupID, e.g. "LIMFJORDEN"
  name: string; // "4 drawer chest LIMFJORDEN beige"
  category: string; // "Chest of Drawers"
  colours: { name: string; sku: string }[]; // this page's colour first, then the others in the same size: one guide covers them all
  specs: Record<string, string>; // spec rows: "Number of drawers" -> "4"
  manual?: string; // official assembly instruction PDF
}

async function page(url: string): Promise<string> {
  const file = path.join(CACHE, new URL(url).pathname.split("/").filter(Boolean).join("__") + ".html");
  if (existsSync(file)) return readFileSync(file, "utf8");
  await sleep(2000);
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  const html = await r.text();
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(file, html);
  return html;
}

function parse(url: string, html: string): Facts {
  const groups = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const j = JSON.parse(m[1]);
    return Array.isArray(j) ? j : [j];
  });
  const g = groups.find((j) => j["@type"] === "ProductGroup");
  if (!g) throw new Error(`no ProductGroup JSON-LD: ${url}`);
  // spec rows and resources sit in the page's Next.js payload as escaped JSON
  // ponytail: regex over the unescaped payload; a spec text with a quote or "]" is cut short. JSON.parse the array before Phase 3
  const flat = html.replace(/\\"/g, '"');
  const specs: Record<string, string> = {};
  const start = flat.indexOf('"name":"Size assembled"');
  if (start < 0) throw new Error(`no "Size assembled" spec row: ${url}`);
  const list = flat.slice(flat.lastIndexOf('[{"name"', start), flat.indexOf("]", start));
  for (const [, k, v] of list.matchAll(/\{"name":"([^"]+)","text":"([^"]*)"\}/g)) specs[k] ??= v;
  const manual = flat.match(/"title":"Assembly instruction","urls":\["([^"]+)"/)?.[1];
  type V = { size?: string; sku: string; color: string };
  const colours = [g as V, ...(g.hasVariant ?? []).filter((v: V) => v.size === g.size && v.sku !== g.sku)].map((v: V) => ({ name: v.color, sku: v.sku }));
  // the page's own address, so a product-lookup/<sku> link in pilot.txt still gives the product's slug
  const page = new URL(g.offers?.url ?? url, "https://jysk.co.uk").href;
  return { url: page, slug: new URL(page).pathname.split("/").pop()!, family: g.productGroupID, name: g.name, category: g.category, colours, specs, manual };
}

/** Self assembly: says so, or (when the row is missing, as on some pages) comes with an assembly manual. */
const selfAssembly = (f: Facts) => (f.specs["Assembly status"] ? f.specs["Assembly status"] === "Self assembly" : !!f.manual);

const urls = readFileSync(path.join(DIR, "pilot.txt"), "utf8").split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
const out: Facts[] = [];
for (const url of urls) {
  const f = parse(url, await page(url));
  if (!selfAssembly(f)) {
    console.log(`skip (not self assembly): ${url}`);
    continue;
  }
  out.push(f);
  console.log(`${f.colours[0].sku} ${f.family}: ${f.name}`);
}
writeFileSync(path.join(DIR, "facts.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`${out.length} of ${urls.length} products -> scripts/jysk/facts.json`);
