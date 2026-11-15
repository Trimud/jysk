// parity self-check: node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/parity.check.ts
import assert from "node:assert";
import type { HwItem, HwType, Plan, Step } from "@/lib/types";
import type { ManualFacts } from "../manuals/types";
import { parity } from "./parity-core";

const step = (n: number): Step => ({ n, title: `step ${n}`, tools: [], people: 1, scene: "main", pose: "+y", warnings: [], kind: "general", minutes: 1 });
const hw = (ref: string, s: number, k: number): HwItem => ({ key: `${ref}-${s}-${k}`, kind: "hw", ref, step: s, pos: [0, 0, 0], dir: [0, -1, 0], travel: 10, delay: 0 });
const type = (id: string, name: string, len: number, qty: number): HwType => ({ id, kind: "screw", name, spec: "", len, dia: 4, qty });
// two steps (the plan counts from 0): four 30 mm screws, then two dowels and a wall plug that isn't in the box
const plan = (): Plan => ({
  spec: {} as Plan["spec"],
  parts: [
    { id: "side", label: "1", name: "Side", size: [400, 750, 18], shape: "box", material: "board", qty: 2 },
    { id: "top", label: "2", name: "Top", size: [600, 18, 400], shape: "box", material: "board", qty: 1 },
  ],
  hardware: [type("screw", "Screw", 30, 4), { ...type("dowel", "Wooden dowel", 30, 2), kind: "dowel" }, { ...type("plug", "Wall plug", 35, 1), kind: "plug", notIncluded: true }],
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
    { letter: "C", name: "3 mm hex key", count: 1 }, // the guide's allen key, a tool
    { name: "wall plug (not included)" },
  ],
  steps: [
    { n: 1, parts: ["1"], fittings: [{ letter: "A", count: 4 }, { letter: "C", count: 1 }], people: 1 },
    { n: 2, parts: ["2"], fittings: [{ letter: "B", count: 2 }], people: 1 },
  ],
  choices: [],
  unread: ["the wall plug's size"],
});
type Change = (p: Plan, f: ManualFacts) => void;
/** the kinds of failure a change to the agreeing plan and facts gives, in order */
const kinds = (change: Change) => {
  const [p, f] = [plan(), facts()];
  change(p, f);
  return parity(p, f).failures.map((x) => x.kind);
};

const agree = parity(plan(), facts());
assert.deepStrictEqual(agree, { ok: true, failures: [], unread: ["the wall plug's size"] });

// parts: a count, a label missing either way (a part kept out of the box is exempt), a size within 2 mm or not
assert.deepStrictEqual(kinds((p) => (p.parts[0].qty = 3)), ["part"]);
assert.deepStrictEqual(kinds((_, f) => f.parts.push({ label: "3", name: "shelf", count: 1 })), ["part"]);
const extra = { id: "mattress", label: "9", name: "Mattress", size: [900, 150, 2000] as [number, number, number], shape: "box" as const, material: "soft" as const, qty: 1 };
assert.deepStrictEqual(kinds((p) => p.parts.push(extra)), ["part"]);
assert.deepStrictEqual(kinds((p) => p.parts.push({ ...extra, extra: true })), []);
assert.deepStrictEqual(kinds((p) => (p.parts[0].size = [400, 751, 18])), []);
assert.deepStrictEqual(kinds((p) => (p.parts[0].size = [400, 755, 18])), ["size"]);

// fittings: one count changed fails once (the nearest fitting takes its letter, so the steps still agree)
assert.deepStrictEqual(kinds((_, f) => (f.fittings[0].count = 5)), ["fitting"]);
// a count no guide fitting has, where only a length matches (60 mm hooks, a 60 mm bracket): no pair, both fail
const hooks: Change = (p, f) => {
  p.hardware.push(type("bracket", "Wall bracket", 60, 1));
  f.fittings.push({ letter: "D", name: "hook", count: 9, lenMm: 60 });
};
assert.deepStrictEqual(kinds(hooks), ["fitting", "fitting"]);
// the same count but another length (30 mm dowels read as 14 mm): a pair on count alone fails, once
assert.deepStrictEqual(kinds((_, f) => (f.fittings[1].lenMm = 14)), ["fitting"]);
// no allen key among the guide's tools: the key is a fitting the guide lacks
assert.deepStrictEqual(kinds((p) => (p.tools = [])), ["fitting"]);
// an allen bolt is hardware, not the key: the guide has no fitting for it
assert.deepStrictEqual(kinds((_, f) => f.fittings.push({ letter: "D", name: "Allen bolt", count: 1 })), ["fitting"]);
// a guide fitting no letter takes fails, even placed in no step
assert.deepStrictEqual(kinds((p) => p.hardware.push(type("cam", "Cam lock", 12, 3))), ["fitting"]);
// two of the same count told apart by name: listed first, the cam bolts would take the dowels' letter by order
const cams = (p: Plan, f: ManualFacts) => {
  p.hardware.unshift(type("bolt", "Cam bolt", 0, 2));
  p.items.push(hw("bolt", 0, 0), hw("bolt", 0, 1));
  f.fittings[1].lenMm = undefined;
  f.fittings.push({ letter: "D", name: "cam bolt", count: 2 });
  f.steps[0].fittings.push({ letter: "D", count: 2 });
};
assert.deepStrictEqual(kinds(cams), []);
// told apart by length (the other letter's length unread): listed first, the 16 mm screws would take A by order
const lengths = (p: Plan, f: ManualFacts) => {
  p.hardware.unshift(type("short", "Screw", 16, 4));
  p.items.push(...[0, 1, 2, 3].map((k) => hw("short", 1, k)));
  f.fittings.push({ letter: "D", name: "screw", count: 4 });
  f.steps[1].fittings.push({ letter: "D", count: 4 });
};
assert.deepStrictEqual(kinds(lengths), []);
// nothing tells two apart and they go in different steps: the pairing is a guess, a failure
const tie = (p: Plan, f: ManualFacts) => {
  p.hardware.push(type("s1", "Screw", 0, 2), type("s2", "Screw", 0, 2));
  p.items.push(hw("s1", 0, 0), hw("s1", 0, 1), hw("s2", 1, 0), hw("s2", 1, 1));
  f.fittings.push({ letter: "D", name: "screw", count: 2 }, { letter: "E", name: "screw", count: 2 });
  f.steps[0].fittings.push({ letter: "D", count: 2 });
  f.steps[1].fittings.push({ letter: "E", count: 2 });
};
assert.deepStrictEqual(kinds(tie), ["fitting"]);
// ... but going in the same steps, either pairing reads the same
const sameSteps: Change = (p, f) => {
  tie(p, f);
  for (const i of p.items) if (i.kind === "hw" && i.ref === "s2") i.step = 0;
  f.steps[0].fittings.push({ letter: "E", count: 2 });
  f.steps[1].fittings.pop();
};
assert.deepStrictEqual(kinds(sameSteps), []);

// steps: one dropped, fittings moved between steps, a repeated step (printed count times its repeat)
assert.deepStrictEqual(kinds((p) => p.steps.pop()), ["step-count"]);
assert.deepStrictEqual(kinds((p) => p.items.forEach((i) => i.kind === "hw" && i.ref === "dowel" && (i.step = 0))), ["step-fittings", "step-fittings"]);
const repeat: Change = (p, f) => {
  p.steps[0].repeat = 2;
  p.items = p.items.filter((i, k) => !(i.kind === "hw" && i.ref === "screw" && k > 1));
  f.steps[0] = { ...f.steps[0], fittings: [{ letter: "A", count: 2 }], repeat: 2 };
};
assert.deepStrictEqual(kinds(repeat), []);

// choices: a facts choice the guide doesn't offer, and a guide layout choice (its own step, which the manual hasn't) the facts don't have
assert.deepStrictEqual(kinds((_, f) => (f.choices = [{ atStep: 2, options: ["A", "B"] }])), ["choice"]);
const layouts: Change = (p) => {
  p.steps.push(step(2));
  p.layouts = [{ step: 2, pick: "L", options: [{ id: "L", label: "Left" }, { id: "R", label: "Right" }] }];
};
assert.deepStrictEqual(kinds(layouts), ["choice"]);
console.log("parity ok");
