---
name: manual-check
description: Check a guide against the product's JYSK assembly manual, step by step: fittings and parts by text, then every step's render (zoom circles included) beside the manual's drawing of it. Use when building or changing a family, when the user says a guide doesn't match its manual, or when asked to compare a guide with its PDF.
---

# Checking a guide against its manual

Three passes, cheapest first. A problem the eyes find in pass 3 that a rule could catch goes into pass 1 as a rule, so no one has to see it again.

## 1. Geometry rules (no browser)

- `npm run qa:overlaps -- --only <slug> --why --turns`: clashes, floating fittings, fittings starting inside their own part, screws on a wall bracket that miss its slot, and steps whose new fittings mostly go into faces turned away from the camera (they need a `turn`, as the manual draws them from that side). A flagged step that a `turn` can't fix (the step does something the manual doesn't) needs a family file, not a camera change.
- `npm run qa:callouts -- --only <slug>` (dev server): the zoom circles, and notes for circles that see their fitting only through its own part (fine for a counterbore, else the fitting sits inside the part).

Fix every FAIL before going on.

## 2. Text pass and the step pairs

Start the dev server (`npm run dev`; see the gbrain note on its port), then:

```
QA_BASE=http://localhost:<port> PLAYWRIGHT_FROM=<folder with playwright> npm run qa:manual -- --only <slug> [--pdf <file>]
```

- It FAILs on a legend count or a numbered part (label, size, count) the guide doesn't match. Fix those first.
- `either/or on page N`: the manual offers ways on (pages pointed to), and the guide must offer as many layouts (`b.layouts`), the manual's first as the default. Check each layout's pairs too (`--only slug@B`).
- `holes <label>`: the round marks inside each panel drawn face on on the parts pages (read from the PDF's vector drawing) against the face of that part the guide drills most. A FAIL saves the panel as `.qa/manual/<slug>/holes-<label>.png`: look at it. Rows of shelf-pin holes, runner and hinge pilot holes are drilled with `b.hole(part, at, outwardNormal, r)` even where the fitting itself is fitted with `hole: false`. Exact positions come off the same vector drawing (`pdftocairo -svg`: each hole is a ring of short strokes inside the panel's outline). Marks that aren't holes (a rail's folded tabs) go in `NOT_HOLES` in scripts/qa/manual.ts with the reason. Labels drawn as curves (no text layer on the parts page) aren't checked: compare those pages by eye.
- It pairs each manual step with a guide step (in order, matching fittings) and lists the pairs. Read `fittings differ` lines: the manual's step fitting box against what the guide fits in that step. `no guide step` or `no manual step` means a step is missing, merged or split (the manual's either/or layouts show as one unpaired step, which is fine).
- It writes one picture per pair to `.qa/manual/<slug>/pairs/NN.png`: the manual's step on the left, the guide's step as the app shows it at the end of its animation, zoom circles and all, on the right.

## 3. The visual pass: every pair, nothing skipped

Look at every `pairs/NN.png`. For a long guide, hand the pairs to subagents, about ten each, each with this checklist and the paths, so the main context stays small. Per pair, compare the zoom circles and the main view with the manual's drawing and insets:

1. **Which parts are in the picture.** Only the ones the manual's step drawing shows: a frame or a drawer the manual makes on its own, apart, stays out of the main build (a `scene`) until the step that joins it on. All three frames standing in a step that shows only the middle one is wrong.
2. **What each fitting is.** Its shape against the manual's drawing of it in the step's box: a headless threaded rod is not a bolt, a double cam bolt is not a dowel. The name in the parts list too.
3. **Where each fitting sits on its part and on other fittings.** Screws go through the holes or slot of what they fix (a bracket's slot, a hinge's plate, a runner's holes, a joining plate's hole), not beside it. Dowels and cam bolts in the right edge and hole row; left and right not swapped.
4. **Counts.** As many fittings drawn as the manual's box for the step says (times any "x3").
5. **Which face and which way up.** The part lying as the manual draws it (face up or down, which end towards you). When the manual draws the step from behind or below and the fittings are hidden in ours, the step needs a `turn`. Pencil lines the manual draws (a line to nail along) are drawn too: `b.pencil(part, a, b)`.
6. **Motion.** How the manual brings a part in (tilted onto runners, sides eased apart, slid along grooves). Note when the engine can't show it.
7. **Words.** The step's tools (qa:manual flags an allen key the manual's box doesn't list, or the other way round), people and warnings (two people, wall fixing, tighten to 80%) against the manual's icons; the part numbers it names.
8. **Holes.** Every hole the manual's panel shows is drilled in ours, in the same place: shelf-pin rows, runner and hinge screw holes (check the parts pages too, not only the steps).
9. **Before calling a line a part.** A line or seam in the manual that doesn't match a part's edge is usually a pencil line or a fold: check the parts page's count before reporting a missing or extra part.

Write what you find to `.qa/manual/<slug>/review.md`: one line per pair, `ok` or the problem, with the pair number. Report problems before fixing them.

## After a fix

- A fix in a family file: `npm run jysk:check`, `npm run qa:snapshots -- --only <slug>` and approve.
- A fix in `drawable.ts`, `stage.ts`, `builder.ts`, `frame.ts` or `sizes.ts`: `qa:snapshots -- --all`.
- A problem a rule could have caught: add the rule to `scripts/qa/overlaps.ts` (as `bracketScrews` does) and run it across all 600 guides, since the same mistake is usually in a shared builder too.
- Save a new kind of mistake to gbrain (`remember`, `entity: "jysk"`).
