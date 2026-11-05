# Credits

This project is a fork of [Bygga](https://github.com/Nutlope/bygga)
([usebygga.com](https://www.usebygga.com)), forked from upstream commit
`a02629a`. The 3D engine, guide UI and plan generators are their work.

Original authors (from the upstream git history):

- Youssef
- Hassan El Mghari ([@Nutlope](https://github.com/Nutlope))

Bygga is released under the MIT License; its copyright notice is kept unchanged
in [LICENSE](LICENSE) ("Copyright (c) 2026 Bygga contributors"). The full
upstream commit history is preserved in this repository, and upstream is
tracked as the `upstream` git remote.

## What changed from Bygga

- **JYSK instead of IKEA.** The IKEA catalog, its import pipeline, plan families and drawings are gone. `scripts/jysk` imports JYSK's full self-assembly range from its sitemap (600 products), with spec facts, colours, sizes, article numbers and manual links.
- **New guide families, each matched to its JYSK manual.** Among them: LIMFJORDEN chests, wardrobes, bed and TV bench, the steel shelving (ASTRUP, GLUDSTED, TRAPPEDAL and more), and the chairs that only take legs. The engine also gained new pieces: tapered legs, bent tube arcs, oval glass shelves and two-tone colours.
- **Browse by JYSK's categories.** Category pages at JYSK's own addresses (`/bedroom/beds/...`), with breadcrumbs, a mega menu, a drill-down sheet on phones and JYSK-style filters with live counts. Search by 7-digit article number.
- **Guide pages.** Doors and drawers open on click, an X-ray toggle for hidden fittings, a pause button on the 3D preview, size arrows that fade behind the product, and the article number and manual link on the cover.
- **New brand: assemble.help.** New name, logo, icons, blue on white look, and a share image and share tags for every page.
- **AI and voice switched off.** Both sit behind `NEXT_PUBLIC_AI`, off for launch.
- **Feedback by email.** Sent through Brevo instead of saved to Upstash, with a privacy page that says so.
- **Checks before every deploy.** `jysk:check` builds every guide, `qa:overlaps` catches parts running through each other or floating, and `qa:snapshots` compares every view with the approved drawing. CI and Vercel run the checks, so a broken guide never deploys.
- **Hosting.** Node 26, functions in Frankfurt (`fra1`), and Vercel skips builds when nothing the site uses changed.
