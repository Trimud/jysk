/**
 * A built guide against what a reader found in its manual (ManualFacts): the same parts, fittings, counts and steps,
 * each step bringing in the same copies of each part, its fittings in the same parts and the piece lying the same way.
 * Fittings not included (wall plugs and screws: the plan's `notIncluded`, a facts name ending "(not included)") are left
 * out on both sides, as qa:manual leaves them out. Self-check: scripts/qa/parity.check.ts.
 */
import type { HwItem, HwType, Plan, Pose } from "@/lib/types";
import type { FactsPose, ManualFacts } from "../manuals/types";

export type ParityFailure = {
  kind: "part" | "fitting" | "step-count" | "step-fittings" | "step-parts" | "step-placement" | "step-pose" | "size" | "choice";
  detail: string;
};

/**
 * A facts pose as the plan's Step.pose: the piece's face that points up, POSE_EULER (src/lib/plan/math.ts) turning it to
 * +y. The front is +z (elverum.ts "+z" lying on its back, gludsted.ts "-z" front down), the left side -x (the left sides
 * of limfjorden-tvbench.ts and jenslev.ts sit at -x); a piece on its left side has its right side, +x, up.
 */
export const FACTS_POSE: Record<FactsPose, Pose> = {
  upright: "+y",
  upside_down: "-y",
  on_back: "+z",
  face_down: "-z",
  on_left_side: "+x",
  on_right_side: "-x",
};

/** what is wrong with the steps of a facts file a reader wrote (an older shape, a pose not named), or nothing */
export function stepsProblem(facts: ManualFacts): string | undefined {
  const label = (x: unknown) => typeof x === "string";
  for (const m of facts.steps) {
    const at = `step ${m?.n}`;
    if (!Array.isArray(m?.parts) || !m.parts.every((p) => label(p?.label) && typeof p?.count === "number"))
      return `${at}: parts must be { label, count } copies (an older facts shape: read the manual again)`;
    if (!Array.isArray(m.fittings) || !m.fittings.every((f) => label(f?.letter) && typeof f?.count === "number" && (f.into === undefined || (Array.isArray(f.into) && f.into.every(label)))))
      return `${at}: fittings must be { letter, count, into?: labels }`;
    if (m.pose !== undefined && !(m.pose in FACTS_POSE)) return `${at}: pose ${JSON.stringify(m.pose)} is none of ${Object.keys(FACTS_POSE).join(", ")}`;
  }
}

const NOT_INCLUDED = /\(not included\)\s*$/i;
// the manual draws its hex key with the fittings, lettered; the guide keeps it as a tool (plan.tools "allen"), not
// hardware. Only a key's own name ("3 mm hex key", "allen key", "key"): an allen bolt or a lock key is hardware.
const isKey = (name: string) => /^(?:(?:hex|allen) )?key$/i.test(name.replace(/\d+(?:[.,]\d+)?\s*mm/gi, "").replace(/\s+/g, " ").trim());
// a fitting's name as words to compare ("round wooden dowel" with "Wooden dowel"): plural s off, filler words out
const STOP = new Set(["mm", "with", "and", "the", "for", "not", "included"]);
const words = (name: string) => new Set((name.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/s$/, "")));
const named = (a: string, b: string) => [...words(a)].filter((w) => words(b).has(w)).length;
const sorted = (v: number[]) => [...v].sort((a, b) => a - b);
const list = (c: Map<string, number>) => [...c].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${k} x${n}`).join(", ") || "-";

/** failures: every way the guide differs; unread: what the reader couldn't read (notes, never failures) */
export function parity(plan: Plan, facts: ManualFacts): { ok: boolean; failures: ParityFailure[]; unread: string[] } {
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
    else if (isKey(f.name)) {
      skip.add(f.letter);
      if (!plan.tools.some((t) => t.id === "allen")) fail("fitting", `${f.letter} ${f.name}: the guide has no allen key among its tools`);
    } else legend.push({ ...f, letter: f.letter, count: f.count });
  }
  // paired as qa:manual pairs a legend: by count, then a length within 2 mm, then the name's words, the letters surest
  // of theirs first, and on a tie leaving the fitting a letter still to come matches. A pair whose lengths (both known:
  // the guide's 0 is none) differ by more than 2 mm agrees on count only, and fails; it keeps its letter for the steps.
  type Letter = (typeof legend)[number];
  const lenOff = (l: Letter, h: HwType) => l.lenMm !== undefined && h.len > 0 && Math.abs(l.lenMm - h.len) > 2;
  const fits = (l: Letter, h: HwType) => (l.lenMm !== undefined && h.len > 0 && !lenOff(l, h) ? 1 : 0);
  const score = (l: Letter, h: HwType) => [fits(l, h), named(l.name, h.name)];
  // where a fitting goes, step by step: two the pairing can't tell apart that go in the same steps can't hide a swap
  const placed = (h: HwType) => JSON.stringify(plan.items.flatMap((i) => (i.kind === "hw" && i.ref === h.id && !i.preset ? [i.step] : [])).sort((a, b) => a - b));
  const said = (l: Letter) => `${l.letter} ${l.name} x${l.count}${l.lenMm ? ` ${l.lenMm} mm` : ""}`;
  const guide = (h: HwType) => `${h.name}${h.len ? ` ${h.len} mm` : ""} x${h.qty}`;
  const letterOf = new Map<string, string>();
  const free = new Set(box);
  const surest = new Map(legend.map((l) => [l, Math.max(0, ...box.map((h) => fits(l, h) * 10 + named(l.name, h.name)))]));
  const order = [...legend].sort((a, b) => surest.get(b)! - surest.get(a)!);
  const missed: Letter[] = [];
  const take = (l: Letter, h: HwType) => (free.delete(h), letterOf.set(h.id, l.letter));
  for (const [k, l] of order.entries()) {
    const claim = (h: HwType) => Math.max(0, ...order.slice(k + 1).filter((o) => o.count === h.qty).map((o) => fits(o, h) * 10 + named(o.name, h.name)));
    const key = (h: HwType) => [...score(l, h), -claim(h)];
    const by = (a: HwType, b: HwType) => key(b).reduce((d, v, i) => d || v - key(a)[i], 0);
    const [h, next] = [...free].filter((h) => h.qty === l.count).sort(by);
    if (!h) {
      missed.push(l);
      continue;
    }
    take(l, h);
    if (lenOff(l, h)) fail("fitting", `${said(l)} paired with ${h.name} ${h.len} mm: the lengths differ`);
    // nothing tells them apart, and they go in different steps: the pairing is a guess, and one that could hide a swap
    else if (next && !by(h, next) && placed(h) !== placed(next)) fail("fitting", `${said(l)}: ${guide(h)} or ${guide(next)}, which go in different steps (no length or name tells them apart)`);
  }
  // a letter of another count: the guide's fitting of the same name (the length nearest first) has the count wrong (one
  // failure, and the steps still read it by its letter). A length alone is no match (60 mm dowels and a 60 mm bracket).
  for (const l of missed) {
    const h = [...free].filter((h) => named(l.name, h.name) > 0).sort((a, b) => fits(l, b) - fits(l, a) || named(l.name, b.name) - named(l.name, a.name))[0];
    if (h) {
      take(l, h);
      fail("fitting", `${said(l)}: the guide's nearest, ${guide(h)}, has ${h.qty}${lenOff(l, h) ? ` and is ${h.len} mm` : ""}`);
    } else fail("fitting", `${said(l)}: the guide has no fitting with that count`);
  }
  // and the other way: a fitting in the guide's box no letter took, placed in a step or not
  for (const h of free) if (h.qty > 0) fail("fitting", `guide fitting ${guide(h)}: no letter in the manual's fittings`);

  // ---- steps: as many as the manual's (a repeated step is one), each with the same fittings. A guide's choosing step
  // (Plan.layouts) is the manual's either/or page, which has no step of its own (as in qa:manual).
  const chooser = new Set(plan.layouts?.map((c) => c.step));
  const steps = plan.steps.filter((s) => !chooser.has(s.n));
  if (steps.length !== facts.steps.length) fail("step-count", `the manual has ${facts.steps.length} steps, the guide ${steps.length}`);
  const code = (ref: string) => letterOf.get(ref) ?? plan.hardware.find((h) => h.id === ref)?.name ?? ref;
  // a repeated step's fittings are all its goes together: the guide places one go's and counts it `repeat` times (as
  // qa:manual does), the manual prints one go's count beside its repeat ("2x")
  const add = (c: Map<string, number>, k: string, n: number) => c.set(k, (c.get(k) ?? 0) + n);
  const paired = steps.slice(0, facts.steps.length);
  // the label of the part a fitting sits in (HwItem.parent, a part item's key): a dowel's part, a screw's the one it goes through
  const labelOf = new Map(plan.items.flatMap((i) => (i.kind === "part" ? [[i.key, plan.parts.find((t) => t.id === i.ref)?.label ?? i.ref] as const] : [])));
  paired.forEach((s, i) => {
    const ours = new Map<string, number>();
    const mine = plan.items.filter((it): it is HwItem => it.kind === "hw" && it.step === s.n && !it.preset && !outside.has(it.ref));
    for (const it of mine) add(ours, code(it.ref), s.repeat ?? 1);
    const m = facts.steps[i];
    const theirs = new Map<string, number>();
    for (const f of m.fittings) if (!skip.has(f.letter)) add(theirs, f.letter, f.count * (m.repeat ?? 1));
    const at = `step ${m.n} (guide: ${s.title})`;
    if (list(ours) !== list(theirs)) fail("step-fittings", `${at}: manual ${list(theirs)}, guide ${list(ours)}`);
    // where a letter's fittings go, when the facts say (an empty into says nothing): as many in each set of parts. A letter whose count in the step
    // is already wrong has failed once (step-fittings) and isn't compared again.
    for (const letter of new Set(m.fittings.filter((f) => f.into?.length && !skip.has(f.letter)).map((f) => f.letter))) {
      if (ours.get(letter) !== theirs.get(letter)) continue;
      const sets = new Map<string, number>();
      for (const f of m.fittings) if (f.letter === letter && f.into?.length) add(sets, [...f.into].sort().join("+"), f.count * (m.repeat ?? 1));
      const into = new Map<string, number>();
      for (const it of mine) if (code(it.ref) === letter) add(into, (it.parent && labelOf.get(it.parent)) || "-", s.repeat ?? 1);
      const inSet = (set: string) => set.split("+").reduce((n, l) => n + (into.get(l) ?? 0), 0);
      const said = (c: Map<string, number>) => [...c].sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `x${n} into ${k}`).join(", ");
      if ([...sets].some(([set, n]) => inSet(set) !== n)) fail("step-placement", `${at}: manual ${letter} ${said(sets)}, guide ${letter} ${said(into)}`);
    }
    if (m.pose && s.pose !== FACTS_POSE[m.pose]) fail("step-pose", `${at}: manual ${m.pose} (${FACTS_POSE[m.pose]}), guide ${s.pose}`);
  });
  // each part's copies, step by step: the step a copy first shows in (a layout's ghost is not it coming in; a quiet step,
  // the drawers slid back in, lists none, as the step panel shows them), one go of a repeated step counted for each go
  const [theirsOf, copies] = [new Map<string, number[]>(), new Map<string, number[]>()];
  const bump = (c: Map<string, number[]>, label: string, k: number, n: number) => {
    const v = c.get(label) ?? paired.map(() => 0);
    c.set(label, v);
    v[k] += n;
  };
  facts.steps.slice(0, paired.length).forEach((m, k) => m.parts.forEach((p) => bump(theirsOf, p.label, k, p.count * (m.repeat ?? 1))));
  for (const it of plan.items) {
    const t = it.kind === "part" ? plan.parts.find((x) => x.id === it.ref) : undefined;
    if (it.kind !== "part" || !t || t.extra) continue;
    const k = paired.findIndex((s) => s.n === it.states.find((x) => !x.ghost)?.step);
    if (k >= 0 && !paired[k].quiet) bump(copies, t.label, k, paired[k].repeat ?? 1);
  }
  for (const label of [...new Set([...copies.keys(), ...theirsOf.keys()])].sort()) {
    const [a, b] = [theirsOf.get(label) ?? paired.map(() => 0), copies.get(label) ?? paired.map(() => 0)];
    const off = paired.flatMap((_, k) => (a[k] !== b[k] ? [`step ${facts.steps[k].n} manual x${a[k]}, guide x${b[k]}`] : []));
    if (off.length) fail("step-parts", `part ${label}: ${off.join("; ")}`);
  }

  // ---- the manual's either/or choices, one layout choice each
  const n = plan.layouts?.length ?? 0;
  if (n !== facts.choices.length) fail("choice", `the manual offers ${facts.choices.length} either/or choices, the guide ${n}`);
  return { ok: !failures.length, failures, unread: facts.unread ?? [] };
}
