/**
 * A built guide against what a reader found in its manual (ManualFacts): the same parts, fittings, counts and steps.
 * Fittings not included (wall plugs and screws: the plan's `notIncluded`, a facts name ending "(not included)") are left
 * out on both sides, as qa:manual leaves them out. Self-check: scripts/qa/parity.check.ts.
 */
import type { HwType, Plan } from "@/lib/types";
import type { ManualFacts } from "../manuals/types";

export type ParityFailure = { kind: "part" | "fitting" | "step-count" | "step-fittings" | "size" | "choice"; detail: string };

const NOT_INCLUDED = /\(not included\)\s*$/i;
// the manual draws its hex key with the fittings, lettered; the guide keeps it as a tool (plan.tools "allen"), not hardware
const KEY = /\bkey\b|allen/i;
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const list = (c: Map<string, number>) => [...c].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} x${n}`).join(", ") || "-";

export function parity(plan: Plan, facts: ManualFacts): { ok: boolean; failures: ParityFailure[] } {
  const failures: ParityFailure[] = [];
  const fail = (kind: ParityFailure["kind"], detail: string) => failures.push({ kind, detail });

  // ---- parts: each label the manual prints, with its count and (when printed) its size within 2 mm, in any order
  for (const p of facts.parts) {
    const t = plan.parts.find((x) => x.label === p.label);
    const said = `${p.label} ${p.name} x${p.count}${p.sizeMm ? ` ${p.sizeMm.join("x")}` : ""}`;
    if (!t) fail("part", `${said}: the guide has no part labelled ${p.label}`);
    else {
      if (t.qty !== p.count) fail("part", `${said}: the guide has ${t.qty} (${t.name})`);
      if (p.sizeMm && sorted(t.size).some((v, i) => Math.abs(v - sorted(p.sizeMm!)[i]) > 2)) fail("size", `${said}: the guide's ${t.name} is ${t.size.join("x")}`);
    }
  }
  // and the other way: a part in the guide's box the manual doesn't show
  for (const t of plan.parts) if (!t.extra && !facts.parts.some((p) => p.label === t.label)) fail("part", `guide part ${t.label} ${t.name} x${t.qty}: not among the manual's parts`);

  // ---- fittings: each lettered fitting in the box pairs with one of the guide's of the same count
  const box = plan.hardware.filter((h) => !h.notIncluded);
  const outside = new Set(plan.hardware.filter((h) => h.notIncluded).map((h) => h.id));
  const skip = new Set(["-"]); // letters left out of the steps: not included, or the hex key (a tool)
  const legend: { letter: string; name: string; count: number; lenMm?: number }[] = [];
  for (const f of facts.fittings) {
    if (NOT_INCLUDED.test(f.name)) {
      if (f.letter) skip.add(f.letter);
    } else if (!f.letter || f.count === undefined) fail("fitting", `${f.name}: the facts give it no ${f.letter ? "count" : "letter"}`);
    else if (KEY.test(f.name)) {
      skip.add(f.letter);
      if (!plan.tools.some((t) => t.id === "allen")) fail("fitting", `${f.letter} ${f.name}: the guide has no allen key among its tools`);
    } else legend.push({ ...f, letter: f.letter, count: f.count });
  }
  // paired as qa:manual pairs a legend: by count, a matching length breaking a tie, the letters surest of theirs first,
  // and on a tie leaving the fitting a letter still to come matches by length
  const fits = (l: (typeof legend)[number], h: HwType) => (l.lenMm !== undefined && l.lenMm === h.len ? 1 : 0);
  const letterOf = new Map<string, string>();
  const free = new Set(box);
  const surest = new Map(legend.map((l) => [l, Math.max(0, ...box.map((h) => fits(l, h)))]));
  const order = [...legend].sort((a, b) => surest.get(b)! - surest.get(a)!);
  for (const [k, l] of order.entries()) {
    const claim = (h: HwType) => Math.max(0, ...order.slice(k + 1).filter((o) => o.count === h.qty).map((o) => fits(o, h)));
    const h = [...free].filter((h) => h.qty === l.count).sort((a, b) => fits(l, b) - fits(l, a) || claim(a) - claim(b))[0];
    if (h) {
      free.delete(h);
      letterOf.set(h.id, l.letter);
    } else fail("fitting", `${l.letter} ${l.name} x${l.count}${l.lenMm ? ` ${l.lenMm} mm` : ""}: the guide has no fitting with that count`);
  }
  // ponytail: the guide's fittings no letter took aren't failed here (one wrong count would fail twice); they show in the
  // steps, by name

  // ---- steps: as many as the manual's (a repeated step is one), each with the same fittings. A guide's choosing step
  // (Plan.layouts) is the manual's either/or page, which has no step of its own (as in qa:manual).
  const chooser = new Set(plan.layouts?.map((c) => c.step));
  const steps = plan.steps.filter((s) => !chooser.has(s.n));
  if (steps.length !== facts.steps.length) fail("step-count", `the manual has ${facts.steps.length} steps, the guide ${steps.length}`);
  const code = (ref: string) => letterOf.get(ref) ?? plan.hardware.find((h) => h.id === ref)?.name ?? ref;
  // a repeated step's fittings are all its goes together: the guide places one go's and counts it `repeat` times (as
  // qa:manual does), the manual prints one go's count beside its repeat ("2x")
  const add = (c: Map<string, number>, k: string, n: number) => c.set(k, (c.get(k) ?? 0) + n);
  steps.slice(0, facts.steps.length).forEach((s, i) => {
    const ours = new Map<string, number>();
    for (const it of plan.items) if (it.kind === "hw" && it.step === s.n && !it.preset && !outside.has(it.ref)) add(ours, code(it.ref), s.repeat ?? 1);
    const m = facts.steps[i];
    const theirs = new Map<string, number>();
    for (const f of m.fittings) if (!skip.has(f.letter)) add(theirs, f.letter, f.count * (m.repeat ?? 1));
    if (list(ours) !== list(theirs)) fail("step-fittings", `step ${m.n} (guide: ${s.title}): manual ${list(theirs)}, guide ${list(ours)}`);
  });

  // ---- the manual's either/or choices, one layout choice each
  const n = plan.layouts?.length ?? 0;
  if (n !== facts.choices.length) fail("choice", `the manual offers ${facts.choices.length} either/or choices, the guide ${n}`);
  return { ok: !failures.length, failures };
}
