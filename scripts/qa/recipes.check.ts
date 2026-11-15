// withRecipe and buildPlan on the fixture recipe (src/data/recipes/__fixture.json): node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/recipes.check.ts
import assert from "node:assert/strict";
import { withRecipe } from "@/lib/recipes";
import { buildPlan } from "@/lib/plan";
import type { ProductSpec } from "@/lib/types";
import { PRODUCTS } from "@/lib/catalog";

const base: ProductSpec = { name: "FIXTURE", variant: "Test shelf", category: "Shelving unit", archetype: "shelf", size: { w: 40, h: 42, d: 30 }, minutes: 20, people: 1, difficulty: 1, source: "catalog", slug: "__fixture" };

const none = { ...base, slug: "__no-recipe" };
assert.equal(withRecipe(none), none, "a slug with no recipe comes back unchanged");

const spec = withRecipe(base);
assert.ok(spec.custom, "withRecipe sets custom");
assert.equal(spec.custom.parts.length, 2);
assert.equal(spec.minutes, 7, "the recipe's spec overrides the listing's");
assert.equal(spec.archetype, "shelf", "the catalog's archetype stays");
assert.deepEqual(spec.recipe, {}, "a recipe giving no size leaves the cover on its drawn or catalog size (recipe.sized unset)");
const plan = buildPlan(spec);
assert.equal(plan.steps.length, 1, `1 step, got ${plan.steps.map((s) => s.title).join(" / ")}`);
assert.equal(plan.approximate, "unchecked", "an unverified recipe is approximate, unchecked");
assert.equal(buildPlan(withRecipe(none)).approximate, "typical", "a guide with no recipe or family is approximate, typical");

const verified = { ...spec, recipe: { verified: { at: "2026-11-15", model: "claude-opus-5-5" as const, parity: true as const, visual: 0.9 } } };
assert.equal(buildPlan(verified).approximate, undefined, "a verified recipe is not approximate");
// withRecipe skips a slug that isn't plain: every catalog slug must be one, or its recipe would never load
const odd = PRODUCTS.filter((p) => !/^[\w-]+$/.test(p.slug)).map((p) => p.slug);
assert.deepEqual(odd, [], "every catalog slug can name a recipe file");
console.log("recipes check: ok");
