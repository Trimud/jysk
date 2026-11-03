<h1 align="center">Monta</h1>

<p align="center">Type the name or article number of a JYSK product and follow every assembly step in 3D, with the parts, screws and tools for each one.</p>

Not affiliated with JYSK. Guides are generated drawings: always check them against the official manual (see [NOTICE](NOTICE)).

## Status

Phase 0 of the build plan: fork and rebrand. The IKEA catalog has been removed and the JYSK catalog pipeline (`scripts/jysk`) arrives in Phase 1, so there are no guides yet.

## Tech stack

- Next.js 16 (App Router, Cache Components), React 19 and TypeScript, plain CSS with Motion, no UI kit
- A three.js line-art stage (`src/engine`) and a parametric plan generator (`src/lib/plan`) that draw each product offline from its catalog row
- A hands-free voice (pre-recorded Kokoro clips) and [Together AI](https://togetherai.link/) features on each visitor's own key; both are switched off for launch
- Share cards drawn by the same engine (`scripts/og/render.mjs`), an A4 print view, and a service worker so opened guides work offline

## Running

1. `git clone https://github.com/Trimud/jysk.git && cd jysk && npm install`
2. `npm run dev`, then open http://localhost:3000
3. Before pushing: `npm run lint && npm run build`

## Credits and license

A fork of [Bygga](https://github.com/Nutlope/bygga) by its original authors, see [CREDITS.md](CREDITS.md). MIT, see [LICENSE](LICENSE).
