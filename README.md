<h1 align="center">assemble.help</h1>

<p align="center">Type the name or article number of a JYSK product and follow every assembly step in 3D, with the parts, screws and tools for each one.</p>

Not affiliated with JYSK. Guides are generated drawings: always check them against the official manual (see [NOTICE](NOTICE)).

## Status

600 JYSK guides, built from the JYSK catalog by `scripts/jysk`. Live at [assemble.help](https://assemble.help).

## Tech stack

- Next.js 16 (App Router, Cache Components), React 19 and TypeScript, plain CSS with Motion, no UI kit
- A three.js line-art stage (`src/engine`) and a parametric plan generator (`src/lib/plan`) that draw each product offline from its catalog row
- A hands-free voice (pre-recorded Kokoro clips) and [Together AI](https://togetherai.link/) features on each visitor's own key; both are switched off for launch
- Share cards drawn by the same engine (`scripts/og/render.mjs`), an A4 print view, and a service worker so opened guides work offline

## Running

1. `git clone https://github.com/Trimud/jysk.git && cd jysk && npm install`
2. `npm run dev`, then open http://localhost:3000
3. Before pushing: `npm run lint && npm run build`

## Checks

`npm run jysk:check` builds every guide, then `npm run qa:overlaps` checks each model: no parts through each other, with doors and drawers closed or open, and no fittings floating in the air. GitHub Actions runs it on every push and pull request, and Vercel runs it before every build, so a guide that fails never deploys.

`npm run qa:snapshots` draws every view of the guides you changed (the finished piece, everything opened, X-ray and every step) and compares each with the drawing you last approved. Open `.qa/report.html` to see what changed, then keep it with `npm run qa:snapshots -- --approve`. It needs the dev server running (`QA_BASE` if it isn't on port 3000) and Playwright (`PLAYWRIGHT_FROM`, a folder whose `node_modules` has it). `--only`, `--family` and `--all` pick other guides; `npm run jysk:build` runs it on the families an import changed.

## Updating from JYSK

`npm run jysk:refresh` runs the whole import, in about an hour (one JYSK page every 2 seconds):

1. `jysk:discover` lists every furniture page in JYSK's sitemap (`scripts/jysk/range.txt`).
2. `jysk:fetch -- --fresh` fetches each page again and reads its facts (`scripts/jysk/cache/` and `facts.json`, both kept out of git). Without `--fresh` a page already fetched is read from the cache.
3. `jysk:build` writes `src/data/jysk-rows.ts` and prints what changed: guides added, changed (and which fields), kept on though JYSK stopped selling them, and moved. A product it can't classify stops the build: extend `classify()` in `scripts/jysk/build.ts`. A colour JYSK dropped while selling the same product under another address stops it too, until the old slug is mapped in `SAME` (`src/data/fixes.ts`), so its link keeps working. It then checks every model, draws the pictures new guides need and redraws the snapshots of changed families (these two need the dev server and Playwright, as above).

Review the snapshot report, approve it, and commit.

## Credits and license

A fork of [Bygga](https://github.com/Nutlope/bygga) by its original authors, see [CREDITS.md](CREDITS.md). MIT, see [LICENSE](LICENSE).
