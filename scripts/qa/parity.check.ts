// parity self-check: node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/parity.check.ts
import assert from "node:assert";
import type { HwItem, Plan, Step } from "@/lib/types";
import type { ManualFacts } from "../manuals/types";
import { parity } from "./parity-core";

const step = (n: number): Step => ({ n, title: `step ${n}`, tools: [], people: 1, scene: "main", pose: "+y", warnings: [], kind: "general", minutes: 1 });
const hw = (ref: string, s: number, k: number): HwItem => ({ key: `${ref}-${s}-${k}`, kind: "hw", ref, step: s, pos: [0, 0, 0], dir: [0, -1, 0], travel: 10, delay: 0 });
// two steps (the plan counts from 0): four 30 mm screws, then two dowels and a wall plug that isn't in the box
const plan = (): Plan => ({
  spec: {} as Plan["spec"],
  parts: [
    { id: "side", label: "1", name: "Side", size: [400, 750, 18], shape: "box", material: "board", qty: 2 },
    { id: "top", label: "2", name: "Top", size: [600, 18, 400], shape: "box", material: "board", qty: 1 },
  ],
  hardware: [
    { id: "screw", kind: "screw", name: "Screw", spec: "4 x 30 mm", len: 30, dia: 4, qty: 4 },
    { id: "dowel", kind: "dowel", name: "Dowel", spec: "8 x 30 mm", len: 30, dia: 8, qty: 2 },
    { id: "plug", kind: "plug", name: "Wall plug", spec: "", len: 35, dia: 8, qty: 1, notIncluded: true },
  ],
  items: [...[0, 1, 2, 3].map((k) => hw("screw", 0, k)), hw("dowel", 1, 0), hw("dowel", 1, 1), hw("plug", 1, 0)],
  steps: [step(0), step(1)],
  tools: [{ id: "allen", included: true }, { id: "screwdriver" }],
});
const facts = (): ManualFacts => ({
  slug: "test",
  source: "vision",
  parts: [
    { label: "1", name: "side", count: 2, sizeMm: [18, 400, 750] },
    { label: "2", name: "top", count: 1 }, // no size printed: no size rule
  ],
  fittings: [
    { letter: "A", name: "screw", count: 4, lenMm: 30 },
    { letter: "B", name: "dowel", count: 2, lenMm: 30 },
    { letter: "C", name: "hex key", count: 1 }, // the guide's allen key, a tool
    { name: "wall plug (not included)" },
  ],
  steps: [
    { n: 1, parts: ["1"], fittings: [{ letter: "A", count: 4 }, { letter: "C", count: 1 }], people: 1 },
    { n: 2, parts: ["2"], fittings: [{ letter: "B", count: 2 }], people: 1 },
  ],
  choices: [],
});

const kinds = (r: ReturnType<typeof parity>) => r.failures.map((f) => f.kind);
const agree = parity(plan(), facts());
assert.deepStrictEqual(agree, { ok: true, failures: [] });

const count = facts();
count.fittings[0].count = 5;
assert.deepStrictEqual(kinds(parity(plan(), count)).filter((k) => k === "fitting"), ["fitting"]);

// the same count but another length (30 mm dowels read as 14 mm): a pair on count alone fails, once
const len = facts();
len.fittings[1].lenMm = 14;
assert.deepStrictEqual(kinds(parity(plan(), len)), ["fitting"]);

const dropped = plan();
dropped.steps.pop();
assert(kinds(parity(dropped, facts())).includes("step-count"));

const off = plan();
off.parts[0].size = [400, 755, 18];
assert.deepStrictEqual(kinds(parity(off, facts())), ["size"]);

const choice = facts();
choice.choices = [{ atStep: 2, options: ["A", "B"] }];
assert.deepStrictEqual(kinds(parity(plan(), choice)), ["choice"]);

// a step repeated (both drawers) counts once; its fittings are the printed count times the repeat
const rep = plan();
rep.steps[0].repeat = 2;
rep.items = rep.items.filter((i, k) => !(i.kind === "hw" && i.ref === "screw" && k > 1));
const repFacts = facts();
repFacts.steps[0] = { ...repFacts.steps[0], fittings: [{ letter: "A", count: 2 }], repeat: 2 };
assert.deepStrictEqual(parity(rep, repFacts).failures, []);

// no allen key among the guide's tools: the key is a fitting the guide lacks
const noKey = plan();
noKey.tools = [];
assert.deepStrictEqual(kinds(parity(noKey, facts())), ["fitting"]);

// a step's fittings differing, with both totals still agreeing
const moved = plan();
for (const i of moved.items) if (i.kind === "hw" && i.ref === "dowel") i.step = 0;
assert.deepStrictEqual(kinds(parity(moved, facts())), ["step-fittings", "step-fittings"]);
console.log("parity ok");
