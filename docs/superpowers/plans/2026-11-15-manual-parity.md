# Manual Parity for Every Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the 563 approximate catalog guides from their JYSK assembly manuals to near 100% parity (same parts, fittings, counts, steps and order), using the cheapest Claude model that measurably gets there, and mark a guide non-approximate only when it has passed checks against its manual.

**Architecture:** One manual becomes one recipe: a `CustomParams` JSON (parts as boxes with sizes and positions, steps with the parts and fittings they add), written by a Claude call that reads the manual's page images, and drawn by the existing `src/lib/plan/custom.ts`. Each recipe passes three gates before it counts: a parity check against facts read from the manual independently (parts, fittings legend, per-step fittings), the existing geometry checks (`qa:overlaps`), and a visual judge comparing each rendered guide step with the manual's step. A calibration run on guides already built and checked by hand picks the cheapest model and effort that pass; products that fail climb a model ladder, then go to a human review queue. Recipes load on the server only, so they add nothing to the client bundle (the IKEA sweep's family files cost about 1.5 MB gzipped there, see `docs/manual-sweep.md`).

**Tech Stack:** TypeScript scripts run with `node --no-warnings --import ./scripts/voice/register.mjs`, `@anthropic-ai/sdk` (Messages API: vision, structured outputs, prompt caching, Message Batches), poppler (`pdftoppm`, `pdftotext`, `pdftocairo`), Playwright via `PLAYWRIGHT_FROM` for the step pairs, Next.js 16 server components.

**Spec:** this conversation's decisions (2026-11-15): guides must follow their manual (AGENTS.md house rule); unverified guides stay listed as "Approximate guide" until verified; cheapest Claude model that still reaches near 100% parity. Background: `docs/manual-sweep.md`, `docs/manual-check-pilot.md`, the `manual-check` skill (`.claude/skills/manual-check/SKILL.md`).

## Global Constraints

- No em dashes or en dashes anywhere (copy, code, comments, commit messages).
- JYSK's drawings, photos and text never enter `src` or `public`: manuals, page images, crops and extracted facts live under `.qa/` (git ignores it). Recipes are our own data; every step title and detail is written in our own words.
- `ANTHROPIC_API_KEY` (or an `ant auth login` profile) comes from the environment; never written to the repo. None of these scripts run in CI.
- Model IDs exactly: `claude-haiku-5-5` ($0.10 / $0.50 per MTok, prompts up to 100K tokens; $0.50 / $2.50 beyond), `claude-sonnet-5-5` ($2 / $10), `claude-opus-5-5` ($4 / $20). Set `output_config.effort` explicitly on every call (Haiku 5.5 and Opus 5.5 default to `medium`). No forced `tool_choice`; use structured outputs (`output_config.format`). Check `stop_reason` for `refusal` and `max_tokens` before reading content.
- Keep every Haiku request under 100K input tokens: page images at most 1568 px on the long side, at most 20 images per request (split longer manuals by page range).
- Every model call appends one line to `.qa/manuals/costs.jsonl`: `{slug, stage, model, effort, input_tokens, output_tokens, cache_read_input_tokens, usd, at}`. Every long run takes `--max-usd` and stops before exceeding it.
- A recipe is non-approximate only when `verified` is set on it (Task 5). Never set `verified` by hand except through `manuals:approve` (Task 9).

## Review Focus

1. A manual printed to PDF as images (no text layer, like EGTVED's): facts must come from the vision path, and `qa:manual` must not report "no problems" when it read nothing. Owned by Task 1 (test) and Task 3.
2. A product with a manual either/or (rail left or right): the recipe offers the options as `layouts`, never picks one from a photo. Owned by Task 6 (prompt rule and parity check that counts choices).
3. A manual covering several products (two sizes in one PDF): each slug's recipe has only its own size's parts and counts. Owned by Task 3 (facts keyed by slug) and Task 4 (size check).
4. A model that refuses or runs out of tokens mid-recipe: the run records it and escalates, never writes a half recipe. Owned by Task 2 (test with a stubbed refusal).
5. A recipe that passes parity but draws parts floating or overlapping: `qa:overlaps` gates it like every other guide. Owned by Task 5 (the existing `jysk:check` runs recipe guides).

---

### Task 0: Manuals for the products whose page links none

Products whose jysk.co.uk page has no assembly-instructions link often have one on another JYSK site. `Fix.manual` in `src/data/fixes.ts` (applied by `fixed()` in `src/lib/catalog.ts`) sets it; HUNDESTED is done that way (jysk.ca).

English sources only (user, 2026-11-15): manuals linked from JYSK's English-language sites, jysk.co.uk, jysk.ie and jysk.ca (jysk.ca: `/media/upfiles/new_instructions/ai_<n>_<NAME> <type> <item no>_<date>.pdf`; jysk.co.uk and jysk.ie: `cdn<1-4>.jysk.com/ttr/ai/<id>`). Not the Baltic or Moldovan sites, not third-party manual sites. Most JYSK manuals are drawings and numbers with no words, so "English" means the source, not the text.

The best match is often another colour of the same product on jysk.co.uk or jysk.ie: its manual's cover lists every article number it covers, so a manual whose cover lists this product's article numbers (`spec.colours[].sku`) is the one. Done that way: LIMFJORDEN bedside table (the white one's manual lists 3670444, 3618924, 3618927).

jysk.ca pages draw their "Download Instructions Here" link with JavaScript, so `curl` doesn't see it: open them in a real browser (the `/browse` skill).

Still without a manual: KNUDBY and ALLINGE armchairs, HASLEV bed frames (single and double), HERNING bookcase, MARKSKEL sideboard + top, VARPELEV office chair, ABILDSKOV 2-seater with console, and the EGENSE, FALSLEV, FERRITSLEV and GEDVED sofa sets.

- [ ] **Step 1:** For each product, open the candidate's cover and parts pages (`pdftoppm -f 1 -l 3 -r 80`) and match the product drawing, the size printed on it and the piece count against the guide's spec. A sofa set of 2 pieces may need two manuals: record both (`manual` takes the first; note the second in a comment until the recipe step supports two).
- [ ] **Step 2:** Add a `manual` fix per match; `npm run jysk:check` passes.
- [ ] **Step 3: Commit** `Manuals from other JYSK sites for products whose page links none`.

### Task 1: `qa:manual` fails when it checked nothing or steps don't match

**Files:**
- Modify: `scripts/qa/manual.ts` (the summary and exit code at the end)

**Interfaces:**
- Produces: exit code 1 with a line starting `fail` when the manual has no text layer and no facts file exists, or when any step pair reports "fittings differ".

- [ ] **Step 1: Reproduce.** Run `npm run qa:manual -- --only coat-rack-egtved-9-hooks-bamboo; echo "exit $?"`. Expected now: "no problems" and `exit 0`.
- [ ] **Step 2: Change the summary** so that "no text layer" becomes `fail no text layer: nothing was checked (run manuals:facts first)` and any "fittings differ" pair counts as a problem.
- [ ] **Step 3: Verify.** Same command: Expected `exit 1` with the `fail no text layer` line. `npm run qa:manual -- --only 4-drawer-chest-limfjorden-beige; echo "exit $?"`: Expected `exit 0`.
- [ ] **Step 4: Commit** `qa:manual fails a manual it could not read, and steps whose fittings differ`.

### Task 2: Manual inventory and a Claude client with cost logging

**Files:**
- Create: `scripts/manuals/pdf.ts` (download and render, moved out of `scripts/qa/manual.ts`, which then imports it)
- Create: `scripts/manuals/inventory.ts` (`npm run manuals:inventory -- [--only a,b]`)
- Create: `scripts/manuals/claude.ts`
- Create: `scripts/manuals/claude.check.ts`
- Modify: `package.json` (add `@anthropic-ai/sdk` to devDependencies; scripts `manuals:inventory`, `manuals:facts`, `manuals:recipe`, `manuals:judge`, `manuals:calibrate`, `manuals:run`, `manuals:approve`, all with the register loader)

**Interfaces:**
- Produces: `fetchManual(slug: string): Promise<{ dir: string; pdf: string; pages: string[]; text: boolean } | null>` (`dir` = `.qa/manuals/<slug>/`, pages `p-NN.png` gray, long side 1568 px, `text` = pdftotext gives more than 200 characters).
- Produces: `.qa/manuals/index.json`: `{ [slug]: { url, sha256, pages, text, sharedWith: string[] } }` for every approximate product with `spec.manual` (`sharedWith`: other slugs with the same PDF hash).
- Produces: `ask<T>(o: { slug: string; stage: "facts" | "recipe" | "judge"; model: ModelId; effort: "low" | "medium" | "high"; system: string; content: Anthropic.ContentBlockParam[]; schema: object }): Promise<{ ok: true; data: T; usd: number } | { ok: false; reason: "refusal" | "max_tokens" | "invalid"; usd: number }>`. System prompt carries `cache_control`; streaming with `.finalMessage()`; `max_tokens` 64000; cost from `usage` and the price table above; appends to `costs.jsonl`.
- Produces: `type ModelId = "claude-haiku-5-5" | "claude-sonnet-5-5" | "claude-opus-5-5"` and `LADDER: ModelId[]` in that order.

- [ ] **Step 1: Write `claude.check.ts`** with assertions on two pure helpers: `usdOf(model, usage)` (Haiku, 10,000 in and 2,000 out: `0.002`; Haiku with 120,000 in uses the $0.50 / $2.50 rate) and `outcomeOf(message)` mapping `stop_reason` `refusal` to `{ ok: false, reason: "refusal" }`, `max_tokens` to `"max_tokens"`, and unparsable JSON to `"invalid"`.
- [ ] **Step 2: Run it** (`node --no-warnings --import ./scripts/voice/register.mjs scripts/manuals/claude.check.ts`): Expected fail, module missing.
- [ ] **Step 3: Implement** `pdf.ts`, `claude.ts` (`usdOf`, `outcomeOf`, `ask`), `inventory.ts`.
- [ ] **Step 4: Verify.** The check prints `claude ok`. `npm run manuals:inventory -- --only coat-rack-egtved-9-hooks-bamboo,4-drawer-chest-limfjorden-beige` writes both entries; EGTVED has `text: false, pages: 16`.
- [ ] **Step 5: Full inventory.** `npm run manuals:inventory` covers 549 products (563 approximate minus the 14 with no manual link). Record the text versus image split in the commit message.
- [ ] **Step 6: Commit.**

### Task 3: Manual facts, read independently of the recipe

**Files:**
- Create: `scripts/manuals/types.ts`
- Create: `scripts/manuals/facts.ts` (`npm run manuals:facts -- --only <slugs> --model <id> [--effort high]`)
- Modify: `scripts/qa/manual.ts` (export its text-layer readers so `facts.ts` reuses them)

**Interfaces:**
- Produces in `types.ts`:
  - `ManualFacts = { slug: string; source: "text" | "vision"; model?: ModelId; parts: { label: string; name: string; count: number; sizeMm?: [number, number, number] }[]; fittings: { letter: string; name: string; count: number; lenMm?: number }[]; steps: { n: number; parts: string[]; fittings: { letter: string; count: number }[]; people: 1 | 2 }[]; choices: { atStep: number; options: string[] }[] }`
- Produces: `.qa/manuals/<slug>/facts.json`.

Text-layer manuals use the existing readers (no model call). Image-only manuals: one `ask` call with all pages and the schema; the prompt asks only for what is printed (labels, counts, sizes, step numbers), never wording. For a PDF shared by several slugs, the prompt names the slug's size so counts are for that product.

- [ ] **Step 1: Run** `npm run manuals:facts -- --only 4-drawer-chest-limfjorden-beige` (text layer): Expected `source: "text"`, counts equal to what `qa:manual` prints for it.
- [ ] **Step 2: Run** on `coat-rack-egtved-9-hooks-bamboo` with `--model claude-sonnet-5-5 --effort high`: Expected 9 hooks in `fittings` or `parts` and a size of 1100 x 500 x 50 mm; check by eye against `.qa/manuals/coat-rack-egtved-9-hooks-bamboo/p-*.png`.
- [ ] **Step 3: Commit.**

### Task 4: Parity checker

**Files:**
- Create: `scripts/qa/parity-core.ts`
- Create: `scripts/qa/parity.check.ts`
- Create: `scripts/qa/parity.ts` (`npm run qa:parity -- --only <slugs>`; add the script to `package.json`)

**Interfaces:**
- Consumes: `ManualFacts` (Task 3), `Plan` (`src/lib/types.ts`).
- Produces: `parity(plan: Plan, facts: ManualFacts): { ok: boolean; failures: { kind: "part" | "fitting" | "step-count" | "step-fittings" | "size" | "choice"; detail: string }[] }`.

Rules: every facts part label has a plan part with that label and count; part sizes match within 2 mm on each axis (any order); every fitting letter pairs with one plan fitting type of the same count (pair by count and length, as `qa:manual` does); the plan has as many steps as the manual (a step marked `repeat` counts once); step N's fittings equal the manual's step N fittings; the number of `layouts` choices equals `facts.choices.length`.

- [ ] **Step 1: Write `parity.check.ts`**: a hand-made two-step plan and facts that agree give `ok: true`; changing one count gives exactly one `fitting` failure; dropping a step gives a `step-count` failure; a part 5 mm off gives a `size` failure; a facts choice with no plan `layouts` gives a `choice` failure. Print `parity ok`.
- [ ] **Step 2: Run it**: Expected fail (missing module).
- [ ] **Step 3: Implement** `parity-core.ts` and the CLI (prints failures, exit 1 on any).
- [ ] **Step 4: Verify.** The check prints `parity ok`. `npm run qa:parity -- --only 4-drawer-chest-limfjorden-beige`: Expected exit 0. `npm run qa:parity -- --only coat-rack-egtved-9-hooks-bamboo`: Expected exit 1 listing the missing hooks and slats.
- [ ] **Step 5: Commit.**

### Task 5: Recipes in the app, loaded on the server

**Files:**
- Create: `src/lib/recipes.ts`
- Create: `src/data/recipes/` (one `<slug>.json` per product)
- Modify: `src/lib/plan/index.ts` (catalog spec with `custom` builds with `buildCustom`; `approximate` unless `spec.recipe?.verified`)
- Modify: `src/lib/types.ts` (`ProductSpec.recipe?: { verified?: RecipeVerified }`)
- Modify: every server caller of `catalogSpec` to go through `withRecipe`: `src/app/build/[slug]/page.tsx`, `src/app/build/[slug]/print/page.tsx`, `src/app/dev/og/list/route.ts`, `src/lib/og/guide.tsx`, `scripts/jysk/check.ts`, `scripts/qa/overlaps.ts`, `scripts/qa/manual.ts`
- Modify: the client components that call `catalogSpec` themselves so they take the server's spec instead: `PrintGuide.tsx` (new `spec` prop from its page), `GuideApp.tsx` (already has `initial`; make catalog slugs use it), `src/app/dev/og/Renderer.tsx` (spec from the list route). `HeroStage.tsx` and `Workshop.tsx` keep `catalogSpec`: their products are family-built.

**Interfaces:**
- Produces: `type RecipeFile = { params: CustomParams; spec?: Partial<Pick<ProductSpec, "size" | "minutes" | "people" | "difficulty">>; model: ModelId; verified?: RecipeVerified }`, `type RecipeVerified = { at: string; model: ModelId; parity: true; visual: number; reviewer?: string }`.
- Produces: `withRecipe(spec: ProductSpec): ProductSpec` (reads `src/data/recipes/<slug>.json` with `fs` from `process.cwd()`; returns the spec unchanged when there is none; never imported by a client component).

- [ ] **Step 1: Add a fixture** `src/data/recipes/__fixture.json` (two parts, one step) and a check `scripts/qa/recipes.check.ts`: `withRecipe` on a spec with slug `__fixture` sets `custom`; `buildPlan` of it has 1 step and `approximate: true`; with `verified` set, `approximate` is absent.
- [ ] **Step 2: Run it**: Expected fail.
- [ ] **Step 3: Implement** and rewire the callers listed above.
- [ ] **Step 4: Verify.** The check passes; `npx tsc --noEmit -p .`, `npm run lint`, `npm run jysk:check` all pass; `next build` shows no growth in the client chunk that holds `jysk-rows` (compare the build output before and after).
- [ ] **Step 5: Commit.**

### Task 6: Recipe writer

**Files:**
- Create: `scripts/manuals/recipe.ts` (`npm run manuals:recipe -- --only <slugs> --model <id> --effort <e> [--feedback]`)
- Create: `scripts/manuals/prompts.ts` (`RECIPE_SYSTEM`, adapted from `PLAN_PROMPT` in `src/lib/scan/prompts.ts`)

**Interfaces:**
- Consumes: `fetchManual`, `ask`, `ManualFacts`, `parity`, `RecipeFile`.
- Produces: `writeRecipe(slug: string, model: ModelId, effort: Effort, feedback?: string[]): Promise<{ ok: boolean; failures: string[]; usd: number }>`: writes `src/data/recipes/<slug>.json` (no `verified`) only when the response parses, builds without throwing, and `qa:overlaps` passes for that slug; returns the parity failures.

Prompt rules to include verbatim in `RECIPE_SYSTEM`: one part per numbered part in the manual, labelled with its number or letter; sizes in mm from the parts page; positions as the parts sit in the finished product; one step per manual step in the same order, adding the parts and fittings that step shows; titles and details in your own plain words, never the manual's text; when the manual points to two or more pages for a choice, return each option as a layout and keep option A first. The facts JSON goes in the user message beside the pages, so the recipe is built to agree with it.

- [ ] **Step 1: Run** on `coat-rack-egtved-9-hooks-bamboo` with `claude-sonnet-5-5`, `high`. Expected: a recipe file; `npm run qa:parity -- --only coat-rack-egtved-9-hooks-bamboo` exit 0.
- [ ] **Step 2: Run** with `--feedback` after deliberately deleting one step from the file: the rewrite comes back with the step.
- [ ] **Step 3: Commit** (the script, not the EGTVED recipe: it is verified in Task 9).

### Task 7: Visual judge

**Files:**
- Create: `scripts/manuals/judge.ts` (`npm run manuals:judge -- --only <slugs> --model <id>`)

**Interfaces:**
- Consumes: the step pairs `qa:manual` draws into `.qa/manual/<slug>/pairs/NN.png` (dev server and `PLAYWRIGHT_FROM=/Users/yuriy/.claude/skills/gstack` required).
- Produces: `.qa/manuals/<slug>/judge.json`: `{ model, pairs: { n: number; match: boolean; problems: string[] }[]; score: number }` (`score` = matching pairs / pairs).

The judge prompt asks, per pair: same parts present, same parts joined, the fittings drawn where the manual draws them, the same pose. Answer `match: false` on any difference, with the difference in `problems`.

- [ ] **Step 1: Run** on `4-drawer-chest-limfjorden-beige` (built by hand, checked): Expected score at least 0.95.
- [ ] **Step 2: Run** on the current EGTVED guide (the generic shelf): Expected score below 0.3.
- [ ] **Step 3: Commit.**

### Task 8: Calibration: the cheapest model and effort that reaches parity

**Files:**
- Create: `scripts/manuals/calibrate.ts` (`npm run manuals:calibrate -- --max-usd 30`)
- Modify: `src/lib/plan/index.ts` (export `buildTypical(spec: ProductSpec): Plan`, the kind's builder without families, for negative controls)

**Interfaces:**
- Consumes: `writeRecipe`, `parity`, judge, `ManualFacts`.
- Produces: `.qa/manuals/calibration.md` (table) and `.qa/manuals/calibration.json`.

Gold set (family-built, checked against their manuals): `4-drawer-chest-limfjorden-beige`, `wardrobe-limfjorden-120x200-2-doors-3-drawers-beige`, `shelving-unit-trappedal-5-shelves-warm-oak-colour-black`, `desk-abbetved-48x120-light-oak-colour-white`, `sideboard-jenslev-2-doors-4-drawers-wild-natoak-colour`, `dining-table-marstrand-d110-110x200-white-natural`, `bed-frame-w-storage-billund-euro-single-white-concrete-color`, plus one RAVNKILDE product. For each, a recipe is written in a temporary `src/data/recipes` copy (the family stays, so the gold guide stays the reference), then scored three ways: parity against facts, parity of the recipe plan against the gold family plan (same `parity-core` comparing two plans' parts and per-step fittings), and the judge score.

Grid: `claude-haiku-5-5` at `medium` and `high`, `claude-sonnet-5-5` at `medium` and `high`, `claude-opus-5-5` at `medium`. Each cell gets up to 2 attempts (the second with `--feedback`). Judge calibration: run each judge model on the 8 gold guides (must pass) and on `buildTypical` of the same 8 (must fail); the cheapest judge with 16 of 16 right is the judge.

Decision rule, written into `calibration.md`: the chosen writer is the cheapest cell with parity on 8 of 8 and judge score at least 0.95 on at least 7 of 8 within 2 attempts. If none reaches it, the cheapest that does on 7 of 8, with escalation for the rest. Report USD per product for each cell.

- [ ] **Step 1: Dry run** `--dry` prints the planned calls and an estimate (pages times about 1,600 tokens per image).
- [ ] **Step 2: Run** with `--max-usd 30`. Expected: the full table.
- [ ] **Step 3: Stop for the user.** Show `calibration.md`; the user confirms the writer and judge models before Task 9 runs at scale.
- [ ] **Step 4: Commit** the scripts (not `.qa`).

### Task 9: The run, escalation, review and approval

**Files:**
- Create: `scripts/manuals/run.ts` (`npm run manuals:run -- --writer <id> --effort <e> --judge <id> --max-usd <n> [--only | --limit N] [--order <file>]`)
- Create: `scripts/manuals/approve.ts` (`npm run manuals:approve -- --only <slugs> --reviewer <name>`)
- Create: `.qa/manuals/review.html` (written by `run.ts`)

**Interfaces:**
- Consumes: everything above.
- Produces: verified recipes (`verified` set with `parity: true` and the judge score) and `.qa/manuals/queue.json` (`{ slug, tried: { model, failures }[] }[]` for those that did not pass).

Per product, resumable (skips verified recipes): facts (cached), recipe with the chosen writer (first pass through Message Batches at half price), parity, `qa:overlaps`, judge. On a failure: one retry with feedback, then the next model up `LADDER`, up to `claude-opus-5-5`. Pass: `verified` written without `reviewer`. Fail at the top: queued. `review.html` shows every queued product and a random 5% of the newly verified ones as manual-beside-guide pairs; `manuals:approve` adds `reviewer` (and `verified`, for a queued product the reviewer fixed by hand). The order file is a list of slugs, most-searched first (from Search Console through OpenSEO); without it, A to Z.

- [ ] **Step 1: Run** `--limit 20 --max-usd 10` and review `review.html`.
- [ ] **Step 2: Commit and push** the first 20 verified recipes (`npm run jysk:check` passes first; the approximate label disappears from them).
- [ ] **Step 3: Run the rest** in batches of about 100 with `--max-usd` per batch, reviewing and committing each batch.
- [ ] **Step 4: Queue.** For each queued product, a human (or a coding agent session with the `manual-check` skill) writes a family file instead, the way the 37 existing ones were made.

### Task 10: Close out

- [ ] Update `docs/manual-sweep.md` (or a new `docs/jysk-manual-sweep.md`) with counts verified, queued, approximate, total cost and the chosen models.
- [ ] Save the calibration result and model choice to the project memory (gbrain `remember`, `entity: "jysk"`).
- [ ] The 14 products with no manual link stay approximate; `jysk:refresh` picks up a manual when JYSK adds one.
- [ ] Record voice clips for the new step lines (`npm run voice -- --dry` first for the cost).
