/**
 * Finds what's wrong with a guide's model: npm run qa:overlaps [-- --only <slug>] [-- --jysk] [-- --why]
 * (--why prints where the two boxes of each clash are). Exits 1 on any. Three checks:
 * - closed: every part (and each piece of a part made of several) against every other, and cabinet and drawer runners
 *   against the parts they aren't screwed to, as rotated boxes, on the finished piece. Parts that only touch don't count.
 * - open: the same with each door and drawer opened as "Open all" does, alone and all together; only clashes where
 *   something moved are reported (a door that swings into the drawer beside it).
 * - floating: a fitting whose fixing point isn't on or in the part it belongs to, which X-ray shows hanging in the air.
 * - bracket screws: a screw on a wall bracket's flat leg that isn't in its slot.
 * - buried: a fitting that starts more than 3 mm inside its own part, so its head is hidden (`sunk` marks a counterbore).
 * And notes (not yet a failure) steps whose view hides most of their new fittings: they need a `turn` (--turns lists them).
 *
 * Left out on purpose:
 * - a board 8 mm thick or less (a back, a drawer bottom) reaching up to 12 mm into another part: its groove or rebate
 * - joints meant to overlap, listed by part names in MEANT (crossed feet, a cap over a pole...)
 * - soft parts (cushions, mattresses), which sink into what they sit on
 * - runner against runner: a cabinet runner and its drawer runner interlock
 * - other fittings (dowels, screws, cams...), which go into the parts by design
 * ponytail: a cylinder is the square inside it (so a clash under 15% of its width goes unseen), and half discs and bent
 * tubes are skipped, and so are shaped boards that aren't rectangles. Upgrade: test those shapes exactly when a real case needs it.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from "three";
import { OBB } from "three/examples/jsm/math/OBB.js";
import { PRODUCTS, baseSlug, catalogSpec } from "@/lib/catalog";
import { withRecipe } from "@/lib/recipes";
import { buildPlan } from "@/lib/plan";
import type { HwItem, Opening, PartItem, PartPiece, PartType, Plan, Vec3 } from "@/lib/types";
import { BRACKET, RUNNER, bracketSlot, underBox } from "@/engine/sizes";
import { insidePart, stateAt } from "@/lib/plan/math";
import { stepSight } from "@/lib/plan/sight";
import { JYSK_ROWS } from "@/data/jysk-rows";
import { decodeRows } from "@/lib/jysk";

const TOUCH = 2; // mm of overlap that still counts as touching: a tilted leg's end corner, too small to see
const GROOVE = 12; // mm a thin board may reach into another part
const THIN = 8; // mm: hardboard and MDF backs and bottoms, which sit in grooves

/** Joints that are meant to overlap, by the two parts' names. */
const MEANT: [RegExp, RegExp, string][] = [
  [/^Foot$/, /^Foot$/, "feet crossed in a halving joint"],
  [/^Cross brace$/, /^Cross brace$/, "X braces cross"],
  [/^Leg frame$/, /^Leg frame$/, "X stretchers cross"],
  [/^Pole section$/, /^Top cap$/, "the cap goes over the pole"],
  [/pole$/i, /^Wire shelf$/, "the shelf's corner sleeves go round the poles"],
  [/^Leg$/, /^Table top half$/, "the apron is tenoned into the leg"],
  [/^Spreader bar$/, /^Upper frame$/, "the bar's ends go into the uprights"],
  [/^Armrest$/, /^Mechanism$/, "armrests bolt under the seat beside the mechanism, drawn as one block"],
];
const meant = (a: string, b: string) => MEANT.some(([x, y]) => (x.test(a) && y.test(b)) || (x.test(b) && y.test(a)));

interface Solid {
  name: string;
  moved: boolean; // opened, in an open state
  part: string; // its part type's name, without the piece
  owner: string; // the part key it belongs to (a runner: the part it's screwed to)
  thin: boolean;
  soft: boolean;
  runner: boolean;
  obb: OBB;
}

const quat = (e: Vec3 = [0, 0, 0]) => new Quaternion().setFromEuler(new Euler(e[0], e[1], e[2], "XYZ"));
const frame = (pos: Vec3, rot?: Vec3) => new Matrix4().compose(new Vector3(...pos), quat(rot), new Vector3(1, 1, 1));

/** A box of half sizes `half` around `center` in the frame `m`. OBB.applyMatrix4 moves a box's centre without turning it, so the offset goes into the matrix. */
function obbOf(center: Vec3, half: Vec3, m: Matrix4) {
  return new OBB(new Vector3(), new Vector3(...half)).applyMatrix4(m.clone().multiply(new Matrix4().makeTranslation(...center)));
}

/** A part type's pieces: its own, or itself as one. */
const piecesOf = (t: PartType): PartPiece[] => t.pieces ?? [{ shape: t.shape, size: t.size, pos: [0, 0, 0] }];

/**
 * A piece's box in its part's frame: [centre, half sizes], or null for shapes this check skips. `full`: every piece's
 * whole bounding box, for asking whether a point is on it rather than whether something runs through it.
 */
function pieceBox(p: PartPiece, full = false): [Vec3, Vec3] | null {
  const half: Vec3 = [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2];
  if (full || p.shape === "box") return [p.pos, half];
  // a cylinder (along y) as the square inside it: tubes meeting at an angle or end to side don't clash at their corners
  if (p.shape === "cyl") return [p.pos, [half[0] / Math.SQRT2, half[1], half[2] / Math.SQRT2]];
  // a shaped board only when it is a plain rectangle: a curved one's box is far bigger than it
  if (p.shape === "slab" && p.outline && p.outline.length === 4 && p.outline.every(([x, z]) => p.outline!.filter((c) => c[0] === x).length === 2 && p.outline!.filter((c) => c[1] === z).length === 2)) {
    const xs = p.outline.map((c) => c[0]), zs = p.outline.map((c) => c[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return [[p.pos[0] + (x0 + x1) / 2, p.pos[1], p.pos[2] + (z0 + z1) / 2], [(x1 - x0) / 2, p.size[1] / 2, (z1 - z0) / 2]];
  }
  // ponytail: a bent board (a backrest) is skipped too, its box is mostly the air inside its bend; insidePart knows its shape
  return null;
}

/** A plan's parts, part types and fittings by id, and each part's frame on the finished piece. */
function indexOf(plan: Plan) {
  const parts = plan.items.filter((i): i is PartItem => i.kind === "part");
  return {
    plan,
    parts,
    byKey: new Map(parts.map((p) => [p.key, p])),
    types: new Map(plan.parts.map((t) => [t.id, t])),
    hw: new Map(plan.hardware.map((h) => [h.id, h])),
    world: new Map(parts.map((p) => [p.key, frame(p.final.pos, p.final.rot)])),
  };
}
type Index = ReturnType<typeof indexOf>;

/** How the engine holds a fitting: its local -y along `dir`, turned by `twist` about it, in its parent's frame. */
function holder(it: HwItem, parent?: Matrix4) {
  const dir = new Vector3(...it.dir).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir);
  if (it.twist) q.premultiply(new Quaternion().setFromAxisAngle(dir, it.twist));
  const m = new Matrix4().compose(new Vector3(...it.pos), q, new Vector3(1, 1, 1));
  return parent ? m.premultiply(parent) : m;
}

/** The finished piece as boxes, with the parts in `moves` moved by their matrix (opened). */
function solids(ix: Index, moves = new Map<string, Matrix4>(), full = false): Solid[] {
  const world = (k: string) => (moves.has(k) ? ix.world.get(k)!.clone().premultiply(moves.get(k)!) : ix.world.get(k)!);
  const out: Solid[] = [];
  for (const p of ix.parts) {
    const t = ix.types.get(p.ref)!;
    const m = world(p.key);
    piecesOf(t).forEach((pc, i) => {
      const box = pieceBox(pc, full);
      if (!box) return;
      // a piece turns about its own centre
      const obb = obbOf([0, 0, 0], box[1], m.clone().multiply(frame(box[0], pc.rot)));
      out.push({ part: t.name, name: t.pieces ? `${t.name} (piece ${i + 1})` : t.name, owner: p.key, moved: moves.has(p.key), soft: t.material === "soft", runner: false, thin: Math.min(...box[1]) * 2 <= THIN, obb });
    });
  }
  const depth = RUNNER.body + RUNNER.lip;
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || it.wall) continue;
    const h = ix.hw.get(it.ref)!;
    if (h.kind !== "runner") continue;
    const u = h.form === "under" ? underBox(h.len) : null; // one under a drawer side's edge
    const obb = u ? obbOf(u.center, u.half, holder(it, it.parent ? world(it.parent) : undefined)) : obbOf([0, depth / 2, 0], [RUNNER.w / 2, depth / 2, h.len / 2], holder(it, it.parent ? world(it.parent) : undefined));
    out.push({ name: h.name, part: h.name, owner: it.parent ?? it.key, moved: !!it.parent && moves.has(it.parent), thin: false, soft: false, runner: true, obb });
  }
  return out;
}

const WHY = process.argv.includes("--why");
/** "Name: x a..b, y a..b, z a..b" in mm, the world box round it, for reading a clash. */
function where(s: Solid) {
  const pts = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [-1, 1].map((k) => new Vector3(i * s.obb.halfSize.x, j * s.obb.halfSize.y, k * s.obb.halfSize.z).applyMatrix3(s.obb.rotation).add(s.obb.center))));
  const r = (k: "x" | "y" | "z") => `${k} ${Math.min(...pts.map((p) => p[k])).toFixed(1)}..${Math.max(...pts.map((p) => p[k])).toFixed(1)}`;
  return `${s.name}: ${r("x")}, ${r("y")}, ${r("z")}`;
}

const shrunk = (o: OBB, by: (h: Vector3) => Vector3) => Object.assign(o.clone(), { halfSize: by(o.halfSize.clone()) });
const groove = (v: number) => (v <= THIN / 2 ? v : Math.max(0, v - GROOVE));

/** Pairs of solids that run through each other; with `moves`, only pairs where something moved. */
function clashes(ix: Index, moves?: Map<string, Matrix4>): string[] {
  const s = solids(ix, moves);
  // touching doesn't count: each box less TOUCH, once
  const touch = s.map((x) => shrunk(x.obb, (h) => h.subScalar(TOUCH / 2).max(new Vector3())));
  const found = new Set<string>();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      if (a.owner === b.owner || a.soft || b.soft || (a.runner && b.runner) || meant(a.part, b.part)) continue;
      if (moves && !a.moved && !b.moved) continue;
      if (!touch[i].intersectsOBB(touch[j])) continue;
      // a thin board whose edges reach into another part: test again with GROOVE mm off its edges
      if (a.thin || b.thin) {
        const [thin, other] = a.thin ? [a, touch[j]] : [b, touch[i]];
        if (!shrunk(thin.obb, (h) => new Vector3(groove(h.x), groove(h.y), groove(h.z))).intersectsOBB(other)) continue;
      }
      found.add([a.name, b.name].sort().join(" x ") + (WHY ? `\n    ${where(a)}\n    ${where(b)}` : ""));
    }
  return [...found];
}

/** How "Open all" moves an opening's parts: a drawer slides, a door turns about its hinge line. */
function openMatrix(o: Opening) {
  if (o.slide) return new Matrix4().makeTranslation(...o.slide);
  const h = o.hinge!;
  const at = new Vector3(...h.at);
  return new Matrix4()
    .makeTranslation(at.x, at.y, at.z)
    .multiply(new Matrix4().makeRotationAxis(new Vector3(...h.axis).normalize(), h.angle))
    .multiply(new Matrix4().makeTranslation(-at.x, -at.y, -at.z));
}

/** Clashes with each opening open on its own, then with all of them open. */
function openClashes(ix: Index): string[] {
  const opens = ix.plan.opens ?? [];
  const found = new Set<string>();
  const states = opens.map((o) => [o]);
  if (opens.length > 1) states.push(opens);
  for (const st of states) {
    const moves = new Map(st.flatMap((o) => o.parts.map((k) => [k, openMatrix(o)] as const)));
    const label = st.length > 1 ? "all open" : `${ix.types.get(ix.byKey.get(st[0].parts[0])!.ref)!.name} open`;
    for (const c of clashes(ix, moves)) found.add(`${label}: ${c}`);
  }
  return [...found];
}

const PIN = 5; // mm a fitting's fixing point may sit off its part's surface: a bolt head on a washer
/** Fittings whose fixing point is on nothing: not their part, nor anything else (a runner's screws sit on the
 *  runner, a leg in its cup). They hang in the air in X-ray. */
function floating(ix: Index): string[] {
  const all = solids(ix, undefined, true).map((x) => shrunk(x.obb, (h) => h.addScalar(PIN)));
  // spacers and leg cups are something to sit on too: drawn as a cylinder `len` out of the face
  for (const it of ix.plan.items) {
    const h = it.kind === "hw" ? ix.hw.get(it.ref)! : null;
    if (it.kind === "hw" && h?.kind === "spacer") all.push(obbOf([0, h.len / 2, 0], [h.dia / 2 + PIN, h.len / 2 + PIN, h.dia / 2 + PIN], holder(it, it.parent ? ix.world.get(it.parent) : undefined)));
  }
  const found = new Set<string>();
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || !it.parent || it.wall) continue;
    const at = new Vector3(...it.pos).applyMatrix4(ix.world.get(it.parent)!);
    if (all.some((o) => o.containsPoint(at))) continue;
    const t = ix.types.get(ix.byKey.get(it.parent)!.ref)!;
    found.add(`floating: ${ix.hw.get(it.ref)!.name} off the ${t.name}` + (WHY ? ` at [${it.pos.map((v) => v.toFixed(1)).join(", ")}] in its frame, the part ${t.size.join(" x ")}${t.pieces ? ` in ${t.pieces.length} pieces: ${t.pieces.map((pc) => `${pc.shape} ${pc.size.map((v) => Math.round(v)).join("x")} at ${pc.pos.map((v) => Math.round(v)).join(",")}`).join("; ")}` : ""}` : ""));
  }
  return [...found];
}

const SINK = 3; // mm a fitting may start below its part's surface: a flush connector bolt's head
/** Fittings that start inside their own part instead of at its surface, so their head is buried (unless marked as
 *  sunk in a counterbore). A dowel or cam bolt the builder starts deeper on purpose doesn't count. */
function buried(ix: Index): string[] {
  const found = new Set<string>();
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || !it.parent || it.wall || it.sunk) continue;
    const h = ix.hw.get(it.ref)!;
    if (h.kind === "dowel" || h.kind === "camScrew") continue;
    const t = ix.types.get(ix.byKey.get(it.parent)!.ref)!;
    let d = 0;
    while (d < 200 && insidePart(t, [it.pos[0] - it.dir[0] * d, it.pos[1] - it.dir[1] * d, it.pos[2] - it.dir[2] * d])) d += 0.5;
    if (d > SINK) found.add(`buried: ${h.name} starts ${d} mm inside the ${t.name}` + (WHY ? ` at [${it.pos.map((v) => v.toFixed(1)).join(", ")}] going [${it.dir.map((v) => +v.toFixed(2)).join(", ")}]` : ""));
  }
  return [...found];
}

/** Screws at a wall bracket that miss its slot: through the metal, or beside the strip (the slot is where they go). */
function offSlot(ix: Index): string[] {
  const found = new Set<string>();
  const hws = ix.plan.items.filter((i): i is HwItem => i.kind === "hw");
  const parentOf = (it: HwItem) => (it.parent ? ix.world.get(it.parent) : undefined);
  for (const br of hws) {
    const h = ix.hw.get(br.ref)!;
    if (h.kind !== "bracket") continue;
    const local = holder(br, parentOf(br)).invert();
    const [s0, s1] = bracketSlot(h.len); // the slot along the flat leg (z), x = 0
    for (const sc of hws) {
      const sh = ix.hw.get(sc.ref)!;
      if (sh.kind !== "screw") continue;
      const p = new Vector3(...sc.pos).applyMatrix4(parentOf(sc) ?? new Matrix4()).applyMatrix4(local);
      // only screws on or beside the flat leg: not the wall screw through the upright one
      if (Math.abs(p.y) > 12 || Math.abs(p.x) > 25 || p.z < -BRACKET.bend || p.z > h.len - BRACKET.bend) continue;
      if (Math.abs(p.x) <= 1 && p.z >= s0 + 2 && p.z <= s1 - 2) continue;
      found.add(`bracket screw off its slot: ${sh.name} ${sh.spec} at the ${h.name}` + (WHY ? ` (${p.x.toFixed(1)} across, ${p.z.toFixed(1)} along; the slot is x 0, ${s0.toFixed(1)} to ${s1.toFixed(1)})` : ""));
    }
  }
  return [...found];
}

/** Shelf pins with no hole under them: a pin always goes into a drilled hole (a row of them, on a manual's uprights). */
function pinless(ix: Index): string[] {
  const found = new Set<string>();
  const parts = new Map(ix.plan.items.filter((i): i is PartItem => i.kind === "part").map((i) => [i.key, i]));
  for (const it of ix.plan.items) {
    if (it.kind !== "hw" || ix.hw.get(it.ref)!.kind !== "pin" || !it.parent) continue;
    const holes = parts.get(it.parent)?.holes ?? [];
    if (!holes.some((h) => Math.hypot(h.p[0] - it.pos[0], h.p[1] - it.pos[1], h.p[2] - it.pos[2]) <= 2)) found.add(`shelf pin with no hole under it in ${ix.plan.parts.find((t) => t.id === parts.get(it.parent!)?.ref)?.name ?? it.parent}` + (WHY ? ` at ${it.pos.map((v) => v.toFixed(0)).join(", ")}` : ""));
  }
  return [...found];
}

/**
 * Screws drawn as the wrong kind: the manuals' short Ø5 and Ø6.3 screws (runners, hinges, drawer runners) are euro
 * screws, blunt with a coarse thread and a countersunk head, not pointed wood screws; nothing thinner is one.
 */
function screwForms(ix: Index): string[] {
  const out: string[] = [];
  for (const h of ix.plan.hardware) {
    if (h.kind !== "screw" || h.notIncluded) continue;
    const euro = (h.dia === 5 || h.dia === 6.3) && h.len <= 20;
    if (euro && h.form !== "euro") out.push(`${h.name} ${h.spec} is a euro screw: give it form "euro"`);
    if (!euro && h.form === "euro") out.push(`${h.name} ${h.spec} drawn as a euro screw, which are only Ø5 or Ø6.3 and up to 20 mm`);
  }
  return out;
}

/**
 * A piece put together in a side scene that comes apart on its way into the build: parts joined there (a fitting on
 * one reaching into the other) and brought in together in one step must arrive as one, with one timing and direction,
 * not one after the other as if they were being fitted again.
 */
function apart(ix: Index): string[] {
  const out: string[] = [];
  const name = (k: string) => ix.types.get(ix.byKey.get(k)!.ref)!.name;
  const joined = (a: string, b: string) =>
    ix.plan.items.some((it) => {
      if (it.kind !== "hw" || it.parent !== a) return false;
      const t = ix.types.get(ix.byKey.get(b)!.ref)!;
      const inv = ix.world.get(b)!.clone().invert();
      // anywhere along it, either way: the builder sinks a dowel into its own part, so its tip may be well past 6 mm
      const len = ix.hw.get(it.ref)!.len;
      return Array.from({ length: Math.ceil((2 * len) / 3) + 1 }, (_, k) => -len + k * 3).some((d) => {
        const p = new Vector3(it.pos[0] + it.dir[0] * d, it.pos[1] + it.dir[1] * d, it.pos[2] + it.dir[2] * d).applyMatrix4(ix.world.get(a)!).applyMatrix4(inv);
        return insidePart(t, p.toArray(), 0.5);
      });
    });
  for (const st of ix.plan.steps) {
    const coming = ix.parts.flatMap((p) => {
      const i = p.states.findIndex((s) => s.step === st.n);
      const prev = p.states[i - 1];
      return i > 0 && prev.scene !== p.states[i].scene ? [{ key: p.key, from: prev.scene, s: p.states[i] }] : [];
    });
    for (const [i, a] of coming.entries())
      for (const b of coming.slice(i + 1)) {
        if (a.from !== b.from || !(joined(a.key, b.key) || joined(b.key, a.key))) continue;
        if (Math.abs(a.s.delay - b.s.delay) > 0.01 || (a.s.from ?? []).join() !== (b.s.from ?? []).join())
          out.push(`step ${st.n + 1}: ${name(a.key)} and ${name(b.key)}, joined in an earlier step, come into the build apart`);
      }
  }
  return out;
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const slugs = only
  ? only.split(",")
  : args.includes("--jysk")
    ? decodeRows(JYSK_ROWS).map((r) => r.slug ?? baseSlug(r.name, r.variant))
    : PRODUCTS.map((p) => p.slug);

let bad = 0;
const turns: string[] = []; // steps whose view hides most of their new fittings
/**
 * A layout (Plan.layouts) against the first: the same fittings, only placed elsewhere (fewer when one of the two `leaves`
 * something out, the manual's "without the door"), and the parts a pick moves, adds or leaves out shown as ghosts on the
 * step where it is made.
 */
function sameAs(plan: Plan, first: Plan): string[] {
  const out: string[] = [];
  const c = plan.layouts!.findIndex((ch, k) => ch.pick !== first.layouts![k].pick);
  const opt = (p: Plan) => p.layouts![c].options.find((o) => o.id === p.layouts![c].pick)!;
  const name = (p: Plan) => `layout ${opt(p).id}`;
  const qty = (p: Plan) => new Map(p.hardware.map((h) => [h.id, h.qty]));
  const [mq, tq] = [qty(plan), qty(first)];
  const less = opt(plan).leaves ? [mq, tq] : opt(first).leaves ? [tq, mq] : null;
  for (const id of new Set([...mq.keys(), ...tq.keys()])) {
    const [a, b] = [mq.get(id) ?? 0, tq.get(id) ?? 0];
    if (less ? (less[0].get(id) ?? 0) > (less[1].get(id) ?? 0) : a !== b) out.push(`${name(plan)}: ${a} of fitting ${id}, ${name(first)} has ${b}`);
  }
  const at = (p: Plan) => new Map(p.items.filter((i): i is PartItem => i.kind === "part").map((i) => [i.key, i]));
  const mine = at(plan), theirs = at(first);
  // a ghost shows on its own step only: the step after, the part is gone again or built (never left faded)
  for (const [p, own] of [[plan, mine], [first, theirs]] as const)
    for (const it of own.values())
      for (const g of it.states.filter((x) => x.ghost))
        if (stateAt(it.states, g.step + 1).st?.ghost) out.push(`${name(p)}: ${p.parts.find((t) => t.id === it.ref)!.name} stays a ghost after step ${g.step + 1}`);
  for (const [p, own, other] of [[plan, mine, theirs], [first, theirs, mine]] as const)
    for (const [key, it] of own) {
      const o = other.get(key);
      if (o && it.final.pos.every((v, i) => Math.abs(v - o.final.pos[i]) < 1)) continue;
      if (!it.states.some((st) => st.ghost && st.step === p.layouts![c].step))
        out.push(`${name(p)}: ${p.parts.find((t) => t.id === it.ref)!.name} is ${o ? "placed differently from" : "not in"} ${name(p === plan ? first : plan)} but not shown on the step that picks one`);
    }
  return out;
}

// each guide, and each of its manual's other layouts as "slug@B"
const firsts = new Map<string, Plan>();
const all = slugs.flatMap((slug) => {
  const spec = withRecipe(catalogSpec(slug));
  const plan = spec && buildPlan(spec);
  if (plan && !slug.includes("@")) firsts.set(slug, plan);
  return [slug, ...(plan?.layouts && !slug.includes("@") ? plan.layouts.flatMap((c) => c.options.filter((o) => o.id !== c.pick)).map((o) => `${slug}@${o.id}`) : [])];
});
for (const slug of all) {
  const spec = withRecipe(catalogSpec(slug));
  if (!spec) continue;
  const plan = slug.includes("@") ? buildPlan(spec) : firsts.get(slug)!;
  const ix = indexOf(plan);
  plan.steps.forEach((st, i) => {
    const r = stepSight(plan, i);
    if (r.seen * 2 < r.total) turns.push(`${slug} step ${i + 1} "${st.title}": ${r.total - r.seen} of its ${r.total} fittings go into faces turned away from its view`);
  });
  const list = [...clashes(ix), ...openClashes(ix), ...floating(ix), ...buried(ix), ...offSlot(ix), ...pinless(ix), ...screwForms(ix), ...apart(ix), ...(slug.includes("@") ? sameAs(plan, firsts.get(slug.split("@")[0]) ?? buildPlan(withRecipe(catalogSpec(slug.split("@")[0]))!)) : [])];
  if (!list.length) continue;
  bad++;
  for (const c of list) console.log(`FAIL ${slug}: ${c}`);
}
// ponytail: reported, not failed, while the steps it finds wait for their turn; make it a FAIL once they are done
if (process.argv.includes("--turns")) for (const t of turns) console.log(`turn ${t}`);
if (turns.length) console.log(`note ${turns.length} steps open on a view that hides most of their new fittings (add a \`turn\`): --turns lists them`);
console.log(`${all.length - bad} of ${all.length} guides (and layouts) have no clashes, closed or open, and no floating fittings`);
if (bad) process.exit(1);

