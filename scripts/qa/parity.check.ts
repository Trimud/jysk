// parity self-check: node --no-warnings --import ./scripts/voice/register.mjs scripts/qa/parity.check.ts
import assert from "node:assert";
import type { HwItem, HwType, PartItem, Plan, Step, Vec3 } from "@/lib/types";
import type { ManualFacts } from "../manuals/types";
import { factsProblem, parity } from "./parity-core";

const step = (n: number): Step => ({ n, title: `step ${n}`, tools: [], people: 1, scene: "main", pose: "+y", warnings: [], kind: "general", minutes: 1 });
const hw = (ref: string, s: number, k: number, parent?: string): HwItem => ({ key: `${ref}-${s}-${k}`, kind: "hw", ref, parent, step: s, pos: [0, 0, 0], dir: [0, -1, 0], travel: 10, delay: 0 });
const piece = (key: string, ref: string, s: number): PartItem => ({ key, kind: "part", ref, final: { pos: [0, 0, 0], rot: [0, 0, 0] }, states: [{ step: s, scene: "main", pos: [0, 0, 0], rot: [0, 0, 0], delay: 0 }], holes: [] });
const type = (id: string, name: string, len: number, qty: number): HwType => ({ id, kind: "screw", name, spec: "", len, dia: 4, qty });
// two steps (the plan counts from 0): a side and four 30 mm screws into it, then the other side, the top, two dowels into
// the top and a wall plug that isn't in the box
const plan = (): Plan => ({
  spec: {} as Plan["spec"],
  parts: [
    { id: "side", label: "1", name: "Side", size: [400, 750, 18], shape: "box", material: "board", qty: 2 },
    { id: "top", label: "2", name: "Top", size: [600, 18, 400], shape: "box", material: "board", qty: 1 },
  ],
  hardware: [type("screw", "Screw", 30, 4), { ...type("dowel", "Wooden dowel", 30, 2), kind: "dowel" }, { ...type("plug", "Wall plug", 35, 1), kind: "plug", notIncluded: true }],
  items: [...[0, 1, 2, 3].map((k) => hw("screw", 0, k, "side-a")), hw("dowel", 1, 0, "top"), hw("dowel", 1, 1, "top"), hw("plug", 1, 0), piece("side-a", "side", 0), piece("side-b", "side", 1), piece("top", "top", 1)],
  steps: [step(0), step(1)],
  tools: [{ id: "allen", included: true }, { id: "screwdriver" }],
});
const facts = (): ManualFacts => ({
  slug: "test",
  source: "vision",
  parts: [
    { label: "1", name: "side", count: 2, sizeMm: [18, 400, 750], sizePage: 2 },
    { label: "2", name: "top", count: 1 }, // no size printed: no size rule
  ],
  fittings: [
    { letter: "A", name: "screw", count: 4, lenMm: 30 },
    { letter: "B", name: "dowel", count: 2, lenMm: 30 },
    { letter: "C", name: "3 mm hex key", count: 1 }, // the guide's allen key, a tool
    { name: "wall plug (not included)" },
  ],
  steps: [
    { n: 1, parts: [{ label: "1", count: 1 }], fittings: [{ letter: "A", count: 4 }, { letter: "C", count: 1 }], people: 1 },
    { n: 2, parts: [{ label: "2", count: 1 }, { label: "1", count: 1 }], fittings: [{ letter: "B", count: 2 }], people: 1 },
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
/** the failures themselves */
const failures = (change: Change) => {
  const [p, f] = [plan(), facts()];
  change(p, f);
  return parity(p, f).failures;
};

const agree = parity(plan(), facts());
// facts with no overall size: nothing compared, and a note says so
assert.deepStrictEqual(agree, { ok: true, failures: [], unread: ["the wall plug's size"], notes: ["no overallMm: overall size not checked"] });

// parts: a count, a label missing either way (a part kept out of the box is exempt), a size within 2 mm or not
assert.deepStrictEqual(kinds((p) => (p.parts[0].qty = 3)), ["part"]);
assert.deepStrictEqual(kinds((_, f) => f.parts.push({ label: "3", name: "shelf", count: 1 })), ["part"]);
const extra = { id: "mattress", label: "9", name: "Mattress", size: [900, 150, 2000] as [number, number, number], shape: "box" as const, material: "soft" as const, qty: 1 };
assert.deepStrictEqual(kinds((p) => p.parts.push(extra)), ["part"]);
assert.deepStrictEqual(kinds((p) => p.parts.push({ ...extra, extra: true })), []);
assert.deepStrictEqual(kinds((p) => (p.parts[0].size = [400, 751, 18])), []);
assert.deepStrictEqual(kinds((p) => (p.parts[0].size = [400, 755, 18])), ["size"]);
// a size without the page it is printed on is an estimate (an older facts file): not compared, and a note says so
const unprinted = (() => {
  const [p, f] = [plan(), facts()];
  p.parts[0].size = [400, 755, 18];
  delete f.parts[0].sizePage;
  return parity(p, f);
})();
assert.deepStrictEqual(unprinted, { ok: true, failures: [], unread: ["the wall plug's size"], notes: ["no overallMm: overall size not checked", "part sizes with no sizePage (not printed, or an older facts file) were ignored: 1"] });

// the overall size: two 20 mm sides `h` high, 240 mm either side of the middle, and the top between them 540 up, all `d`
// deep: 500 x h x d as built, against the manual's 500 x 1100 x 50 (the side's printed size follows it, so parts agree).
// The screws and the top's dowels (sunk down into it) stay inside the body.
const body = (d: number, h = 1100): Change => (p, f) => {
  p.parts[0].size = [20, h, d];
  p.parts[1].size = [460, 20, d];
  f.parts[0].sizeMm = [20, h, d];
  const at: Record<string, Vec3> = { "side-a": [-240, 0, 0], "side-b": [240, 0, 0], top: [0, 540, 0] };
  for (const i of p.items) if (i.kind === "part") i.final.pos = at[i.key];
  for (const i of p.items) if (i.kind === "hw" && i.ref === "dowel") i.pos = [0, -12, 0];
  f.overallMm = { w: 500, h: 1100, d: 50, page: 1 };
};
/** the one failure: the body's size and what's off in it, then with its fittings (the same, unless given) */
const overall = (guide: string, off: string, fitted = guide, fittedOff = off) => [
  { kind: "size-overall", detail: `manual 500 x 1100 x 50 mm (w x h x d, page 1), guide body ${guide} (the ${off}), with its fittings ${fitted} (the ${fittedOff})` },
];
assert.deepStrictEqual(failures(body(30)), overall("500 x 1100 x 30 mm", "depth differs"));
assert.deepStrictEqual(failures(body(50)), []);
assert.deepStrictEqual(parity(...(() => { const [p, f] = [plan(), facts()]; body(50)(p, f); return [p, f] as const; })()).notes, []);
// w, h and d are directions, not sorted sizes: the same body drawn turned (its width front to back) fails
const sideways: Change = (p, f) => {
  body(50)(p, f);
  const at: Record<string, Vec3> = { "side-a": [0, 0, 240], "side-b": [0, 0, -240], top: [0, 540, 0] };
  for (const i of p.items) if (i.kind === "part") i.final = { pos: at[i.key], rot: [0, Math.PI / 2, 0] };
};
assert.deepStrictEqual(failures(sideways), overall("50 x 1100 x 500 mm", "width and depth differ"));
// 2 percent of 1100 (22 mm) takes 1120, not 1130; 3 mm at least, past 2 percent of 50 (1 mm): 53 deep, not 54
assert.deepStrictEqual(failures(body(50, 1120)), []);
assert.deepStrictEqual(failures(body(50, 1130)), overall("500 x 1130 x 50 mm", "height differs"));
assert.deepStrictEqual(failures(body(53)), []);
assert.deepStrictEqual(failures(body(54)), overall("500 x 1100 x 54 mm", "depth differs"));
// each part as it is turned on the finished piece: the top turned a quarter about y reaches 460 deep
const turned: Change = (p, f) => (body(50)(p, f), p.items.forEach((i) => i.kind === "part" && i.key === "top" && (i.final.rot = [0, Math.PI / 2, 0])));
assert.deepStrictEqual(failures(turned), overall("500 x 1100 x 460 mm", "depth differs"));
// a part kept out of the box (a mattress) is no part of the piece; a fitting standing far out doesn't spoil a body that matches
const around: Change = (p, f) => {
  body(50)(p, f);
  p.parts.push({ ...extra, extra: true });
  p.items.push({ ...piece("mat", "mattress", 1), final: { pos: [0, 0, 3000], rot: [0, 0, 0] } }, { ...hw("screw", 1, 9, "top"), pos: [0, 0, 900] });
  f.fittings[0].count = p.hardware[0].qty = 5;
  f.steps[1].fittings.push({ letter: "A", count: 1 });
};
assert.deepStrictEqual(failures(around), []);
// hooks standing out of the body count: a body 29 deep whose two dowels (33 long, 21 of it out of the top's front) reach
// 50 deep matches the printed 50; sunk in the top, they don't
const hooked = (out: boolean): Change => (p, f) => {
  body(29)(p, f);
  p.hardware[1].len = f.fittings[1].lenMm = 33;
  if (out) for (const i of p.items) if (i.kind === "hw" && i.ref === "dowel") Object.assign(i, { pos: [0, 0, 14.5], dir: [0, 0, -1] });
};
assert.deepStrictEqual(failures(hooked(true)), []);
assert.deepStrictEqual(failures(hooked(false)), overall("500 x 1100 x 29 mm", "depth differs"));
// ... but not one fixing it to the wall, or one not in the box (a wall screw)
const walled = (mark: (p: Plan) => void): Change => (p, f) => (hooked(true)(p, f), mark(p));
assert.deepStrictEqual(failures(walled((p) => p.items.forEach((i) => i.kind === "hw" && i.ref === "dowel" && (i.wall = true)))), overall("500 x 1100 x 29 mm", "depth differs"));
// (a dowel left out of the box no longer pairs with the manual's B: those two failures are the fitting rules')
assert.deepStrictEqual(failures(walled((p) => (p.hardware[1].notIncluded = true))), [
  ...overall("500 x 1100 x 29 mm", "depth differs"),
  { kind: "fitting", detail: "B dowel x2 33 mm: the guide has no fitting with that count" },
  { kind: "step-fittings", detail: "step 2 (guide: step 1): manual B x2, guide -" },
]);

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

// part copies: the second side brought in a step early fails once, naming both steps
const early = failures((p) => p.items.forEach((i) => i.kind === "part" && i.key === "side-b" && (i.states[0].step = 0)));
assert.deepStrictEqual(early, [{ kind: "step-parts", detail: "part 1: step 1 manual x1, guide x2; step 2 manual x1, guide x0" }]);
// a part kept out of the box (a mattress) brought in by a step is no copy of the manual's
assert.deepStrictEqual(kinds((p) => (p.parts.push({ ...extra, extra: true }), p.items.push(piece("mat", "mattress", 1)))), []);
const layouts: Change = (p) => {
  p.steps.push(step(2));
  p.layouts = [{ step: 2, pick: "L", options: [{ id: "L", label: "Left" }, { id: "R", label: "Right" }] }];
};
// a repeated step counts its copies for each go, on either side: a guide side once in a step done twice brings in two
const twice: Change = (p, f) => ((p.steps[0].repeat = 2), (f.steps[0].fittings[0].count = 8));
assert.deepStrictEqual(failures(twice), [{ kind: "step-parts", detail: "part 1: step 1 manual x1, guide x2" }]);
const twiceRead: Change = (_, f) => (f.steps[0] = { ...f.steps[0], fittings: [{ letter: "A", count: 2 }], repeat: 2 });
assert.deepStrictEqual(failures(twiceRead), [{ kind: "step-parts", detail: "part 1: step 1 manual x2, guide x1" }]);
// a quiet step (the drawers slid back in) brings in the other goes of a repeated step: the second side, done in step 1
// twice, slid in in step 2, isn't step 2's copy
const slidIn: Change = (p, f) => {
  repeat(p, f);
  f.steps[1].parts = [{ label: "2", count: 1 }];
  p.steps[1].quiet = true;
};
assert.deepStrictEqual(kinds(slidIn), []);
// ... but past the repeats' copies it brings them in like any step
assert.deepStrictEqual(failures((p) => (p.steps[1].quiet = true)), []);
assert.deepStrictEqual(failures((p, f) => (slidIn(p, f), p.items.push(piece("side-c", "side", 1)))), [{ kind: "step-parts", detail: "part 1: step 2 manual x0, guide x1" }]);
// a copy in a choosing step, or past the manual's steps, is one the manual doesn't bring in
const inChooser: Change = (p, f) => {
  layouts(p, f);
  f.choices = [{ atStep: 3, options: ["L", "R"] }];
  p.items.push(piece("top-2", "top", 2));
};
assert.deepStrictEqual(failures(inChooser), [{ kind: "step-parts", detail: 'part 2: guide x1 in the choosing step "step 2"' }]);
const pastSteps: Change = (p) => (p.steps.push(step(2)), p.items.push(piece("top-2", "top", 2)));
assert.deepStrictEqual(failures(pastSteps), [
  { kind: "step-count", detail: "the manual has 2 steps, the guide 3" },
  { kind: "step-parts", detail: 'part 2: guide x1 in "step 2", past the manual\'s steps' },
]);
// a layout's ghost of a part, shown in the choosing step, isn't it coming in: the step after brings it
const ghost: Change = (p, f) => {
  p.steps = [step(0), { ...step(1), title: "choose" }, step(2)];
  p.layouts = [{ step: 1, pick: "L", options: [{ id: "L", label: "Left" }, { id: "R", label: "Right" }] }];
  f.choices = [{ atStep: 2, options: ["L", "R"] }];
  for (const i of p.items) if (i.kind === "hw" && i.step === 1) i.step = 2;
  for (const i of p.items) if (i.kind === "part" && i.states[0].step === 1) i.states = [{ ...i.states[0], step: 1, ghost: true }, { ...i.states[0], step: 2 }];
};
assert.deepStrictEqual(kinds(ghost), []);

// placement: 9 hook dowels, 5 into the top (2) and 4 into a rail (3), as the facts say
const hooks9 = (into: (k: number) => string): Change => (p, f) => {
  p.parts.push({ id: "rail", label: "3", name: "Rail", size: [600, 70, 20], shape: "box", material: "board", qty: 1 });
  p.hardware.push({ ...type("hook", "Wooden dowel", 60, 9), kind: "dowel" });
  p.items.push(piece("rail", "rail", 1), ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => hw("hook", 1, k, into(k))));
  f.parts.push({ label: "3", name: "rail", count: 1 });
  f.fittings.push({ letter: "D", name: "round wooden dowel", count: 9, lenMm: 60 });
  f.steps[1].parts.push({ label: "3", count: 1 });
  f.steps[1].fittings.push({ letter: "D", count: 5, into: ["2"] }, { letter: "D", count: 4, into: ["3"] });
};
const split = (k: number) => (k < 5 ? "top" : "rail");
assert.deepStrictEqual(kinds(hooks9(split)), []);
// a repeated step: each go's fittings, in each go's parts
const both = (into: (k: number) => string): Change => (p, f) => (hooks9(into)(p, f), (p.steps[1].repeat = 2), (f.steps[1].repeat = 2));
assert.deepStrictEqual(kinds(both(split)), []);
assert.deepStrictEqual(failures(both(() => "rail")), [{ kind: "step-placement", detail: "step 2 (guide: step 1): manual D x10 into 2, x8 into 3, guide D x18 into 3" }]);
const allInRail = failures(hooks9(() => "rail"));
assert.deepStrictEqual(allInRail, [{ kind: "step-placement", detail: "step 2 (guide: step 1): manual D x5 into 2, x4 into 3, guide D x9 into 3" }]);
// one entry naming both parts takes them all, in either
assert.deepStrictEqual(kinds((p, f) => (hooks9(() => "rail")(p, f), (f.steps[1].fittings = [{ letter: "B", count: 2 }, { letter: "D", count: 9, into: ["3", "2"] }]))), []);
// a count already wrong in the step fails once, as step-fittings, not placement too
assert.deepStrictEqual(kinds((p, f) => (hooks9(() => "rail")(p, f), (f.steps[1].fittings[2].count = 3))), ["step-fittings"]);
// an entry without into, or with an empty one, isn't placement-checked
assert.deepStrictEqual(kinds((p, f) => (hooks9(() => "rail")(p, f), (f.steps[1].fittings = [{ letter: "B", count: 2 }, { letter: "D", count: 9, into: [] }]))), []);
assert.deepStrictEqual(kinds((p, f) => (hooks9(() => "rail")(p, f), (f.steps[1].fittings = [{ letter: "B", count: 2 }, { letter: "D", count: 9 }]))), []);

// pose: compared only when the facts give one, and only noted (readers don't read it reliably); on_back is the front
// (+z) up, on_left_side the right side (+x) up
/** a change's failures and its pose notes */
const posed = (change: Change) => {
  const [p, f] = [plan(), facts()];
  change(p, f);
  const r = parity(p, f);
  return [r.failures, r.notes.filter((n) => n.startsWith("step-pose"))];
};
assert.deepStrictEqual(posed((_, f) => (f.steps[0].pose = "on_back")), [[], ["step-pose: step 1 manual on_back (+z), guide +y"]]);
assert.deepStrictEqual(posed((p, f) => ((f.steps[0].pose = "on_back"), (p.steps[0].pose = "+z"))), [[], []]);
assert.deepStrictEqual(posed((p, f) => ((f.steps[0].pose = "on_left_side"), (p.steps[0].pose = "+x"))), [[], []]);
assert.deepStrictEqual(posed((p, f) => ((f.steps[0].pose = "on_right_side"), (p.steps[0].pose = "+x"))), [[], ["step-pose: step 1 manual on_right_side (-x), guide +x"]]);
assert.deepStrictEqual(posed((p) => (p.steps[0].pose = "-x")), [[], []]);
for (const [name, pose] of [["upright", "+y"], ["upside_down", "-y"], ["face_down", "-z"]] as const) {
  assert.deepStrictEqual(posed((p, f) => ((f.steps[0].pose = name), (p.steps[0].pose = pose))), [[], []], name);
  assert.deepStrictEqual(posed((p, f) => ((f.steps[0].pose = name), (p.steps[0].pose = "+z"))), [[], [`step-pose: step 1 manual ${name} (${pose}), guide +z`]], name);
}

// a facts file of the older step shape (parts as bare labels) is named, not read
assert.strictEqual(factsProblem(facts()), undefined);
const old = { ...facts(), steps: [{ n: 1, parts: ["1"], fittings: [], people: 1 }] } as unknown as ManualFacts;
assert.match(factsProblem(old) ?? "", /step 1: parts must be \{ label, count \}/);
assert.match(factsProblem({ ...facts(), steps: [{ ...facts().steps[0], pose: "on_side" as never }] }) ?? "", /pose "on_side"/);
assert.match(factsProblem({ ...facts(), steps: [{ ...facts().steps[0], pose: "toString" as never }] }) ?? "", /pose "toString"/);
// one letter's into entries naming the same part would count its fittings twice
const overlap = { ...facts().steps[1], fittings: [{ letter: "D", count: 5, into: ["2"] }, { letter: "D", count: 4, into: ["2", "3"] }] };
assert.match(factsProblem({ ...facts(), steps: [overlap] }) ?? "", /step 2: fitting D names part 2 in more than one into/);
// a size that isn't numbers would compare as NaN, never off: named, not read
const bad = (f: object) => factsProblem({ ...facts(), ...f } as ManualFacts) ?? "";
assert.match(bad({ overallMm: [500, 1100, 50] }), /overallMm must be \{ w, h, d, page \}/);
assert.match(bad({ overallMm: { w: 500, h: 1100, d: 50 } }), /overallMm must be/);
assert.match(bad({ overallMm: { w: "500", h: 1100, d: 50, page: 1 } }), /overallMm must be/);
assert.strictEqual(bad({ overallMm: { w: 500, h: 1100, d: 50, page: 1 } }), "");
assert.match(bad({ parts: [{ label: "1", name: "side", count: 2, sizeMm: [18, 400], sizePage: 2 }] }), /part 1: sizeMm must be three numbers/);
assert.match(bad({ parts: [{ label: "1", name: "side", count: 2, sizeMm: [18, 400, 750], sizePage: "2" }] }), /part 1: sizePage must be/);

// choices: a facts choice the guide doesn't offer, and a guide layout choice (its own step, which the manual hasn't) the facts don't have
assert.deepStrictEqual(kinds((_, f) => (f.choices = [{ atStep: 2, options: ["A", "B"] }])), ["choice"]);
assert.deepStrictEqual(kinds(layouts), ["choice"]);
console.log("parity ok");
