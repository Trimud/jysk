// wallAway self-check: node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/wallaway.check.ts
// Every wall step with plugs: the piece stands aside unless nothing is in front of the plugs (a board hung on plugs
// put in first: MOLLERUP, HADSTEN, KETTINGE's first step).
import assert from "node:assert";
import { PRODUCTS, catalogSpec } from "@/lib/catalog";
import { withRecipe } from "@/lib/recipes";
import { buildPlan } from "@/lib/plan";
import { wallAway } from "@/lib/plan/wallaway";

const still: string[] = [];
let moves = 0;
for (const { slug } of PRODUCTS) {
  const spec = withRecipe(catalogSpec(slug));
  if (!spec) continue;
  const plan = buildPlan(spec);
  plan.steps.forEach((st, s) => {
    if (!st.wall || !plan.items.some((i) => i.kind === "hw" && i.step === s && plan.hardware.find((h) => h.id === i.ref)?.kind === "plug")) return;
    const a = wallAway(plan, s);
    if (!a) return void still.push(`${slug}#${s}`);
    moves++;
    assert(a.parts.length && a.dir[2] > 0.99, `${slug}#${s} moves its parts off the wall behind it`);
    // the stage puts everything from the first plug on that isn't a plug after the piece is back (Stage.late): that keeps
    // the plan's order only when it all starts once the last plug is in (0.6 s: a fitting's slide in)
    for (const i of plan.items) {
      const plug = i.kind === "hw" && plan.hardware.find((h) => h.id === i.ref)?.kind === "plug";
      const d = i.kind === "hw" ? (i.step === s ? i.delay : -1) : (i.states.find((x) => x.step === s && !x.ghost)?.delay ?? -1);
      assert(plug || d < a.from || d >= a.last + 0.6 - 1e-6, `${slug}#${s}: ${i.key} comes in at ${d}, among its plugs`);
    }
  });
}
assert.deepStrictEqual(still.sort(), ["coat-rack-mollerup-5-hooks-bamboo#1", "wall-hook-hadsten-pack-5#1", "wall-panel-kettinge-160x90-natural#1", "wall-panel-kettinge-200x90-natural#1"]);
assert(moves >= 150, `only ${moves} wall steps move`);
console.log(`wallAway ok: ${moves} wall steps stand aside for the plugs, ${still.length} plug first`);
