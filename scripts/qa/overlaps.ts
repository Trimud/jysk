/**
 * Finds what's wrong with a guide's model: npm run qa:overlaps [-- --only <slug>] [-- --jysk] [-- --why]
 * (--why prints where the two boxes of each clash are). Exits 1 on any. Three checks:
 * - closed: every part (and each piece of a part made of several) against every other, and cabinet and drawer runners
 *   against the parts they aren't screwed to, as rotated boxes, on the finished piece. Parts that only touch don't count.
 * - open: the same with each door and drawer opened as "Open all" does, alone and all together; only clashes where
 *   something moved are reported (a door that swings into the drawer beside it).
 * - floating: a fitting whose fixing point isn't on or in the part it belongs to, which X-ray shows hanging in the air.
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
import { buildPlan } from "@/lib/plan";
import type { HwItem, Opening, PartItem, PartPiece, Plan, Vec3 } from "@/lib/types";
import { JYSK_ROWS } from "@/data/jysk-rows";
import { decodeRows } from "@/lib/ikea";

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
  [/^Rail$/, /^Wire shelf$/, "the wires rest in the rail"],
  [/^Leg$/, /^Table top half$/, "the apron is tenoned into the leg"],
  [/^Spreader bar$/, /^Upper frame$/, "the bar's ends go into the uprights"],
  [/^Armrest$/, /^Mechanism$/, "armrests bolt under the seat beside the mechanism, drawn as one block"],
  [/^Side frame$/, /^Side frame$/, "JEGIND's frames cross in a halving joint"],
  [/^Corner block$/, /^Side frame$/, "a wedge block, drawn as its box"],
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

/** A box of half sizes `half` around `center` in the frame `m`. OBB.applyMatrix4 moves a box's centre without turning it, so the offset goes into the matrix. */
function obbOf(center: Vec3, half: Vec3, m: Matrix4) {
  return new OBB(new Vector3(), new Vector3(...half)).applyMatrix4(m.clone().multiply(new Matrix4().makeTranslation(...center)));
}

/** A piece's box in its part's frame: [centre, half sizes], or null for shapes this check skips. */
function pieceBox(p: PartPiece, full = false): [Vec3, Vec3] | null {
  if (p.shape === "box") return [p.pos, [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2]];
  // a cylinder (along y) as the square inside it: tubes meeting at an angle or end to side don't clash at their corners
  // (`full`: its whole outline, for asking whether a point is on it)
  if (p.shape === "cyl") return [p.pos, [p.size[0] / 2 / (full ? 1 : Math.SQRT2), p.size[1] / 2, p.size[2] / 2 / (full ? 1 : Math.SQRT2)]];
  // a shaped board only when it is a plain rectangle: a curved one's box is far bigger than it
  if (p.shape === "slab" && p.outline && p.outline.length === 4 && p.outline.every(([x, z]) => p.outline!.filter((c) => c[0] === x).length === 2 && p.outline!.filter((c) => c[1] === z).length === 2)) {
    const xs = p.outline.map((c) => c[0]), zs = p.outline.map((c) => c[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    return [[p.pos[0] + (x0 + x1) / 2, p.pos[1], p.pos[2] + (z0 + z1) / 2], [(x1 - x0) / 2, p.size[1] / 2, (z1 - z0) / 2]];
  }
  return null;
}

/** How the engine holds a fitting: its local -y along `dir`, turned by `twist` about it, in its parent's frame. */
function holder(it: HwItem, world: Map<string, Matrix4>) {
  const dir = new Vector3(...it.dir).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, -1, 0), dir);
  if (it.twist) q.premultiply(new Quaternion().setFromAxisAngle(dir, it.twist));
  const m = new Matrix4().compose(new Vector3(...it.pos), q, new Vector3(1, 1, 1));
  return it.parent ? m.premultiply(world.get(it.parent)!) : m;
}

/** The finished piece as boxes, with the parts in `moves` moved by their matrix (opened). */
function solids(plan: Plan, moves = new Map<string, Matrix4>(), full = false): Solid[] {
  const types = new Map(plan.parts.map((t) => [t.id, t]));
  const parts = plan.items.filter((i): i is PartItem => i.kind === "part");
  const world = new Map(parts.map((p) => {
    const m = new Matrix4().compose(new Vector3(...p.final.pos), quat(p.final.rot), new Vector3(1, 1, 1));
    return [p.key, moves.has(p.key) ? m.premultiply(moves.get(p.key)!) : m];
  }));
  const out: Solid[] = [];
  for (const p of parts) {
    const t = types.get(p.ref)!;
    const m = world.get(p.key)!;
    const base = { owner: p.key, moved: moves.has(p.key), soft: t.material === "soft", runner: false };
    const pieces = t.pieces ?? [{ shape: t.shape, size: t.size, pos: [0, 0, 0] as Vec3 }];
    pieces.forEach((pc, i) => {
      const box = pieceBox(pc as PartPiece, full);
      if (!box) return;
      // a piece turns about its own centre
      const local = new Matrix4().compose(new Vector3(...box[0]), quat((pc as PartPiece).rot), new Vector3(1, 1, 1));
      const obb = obbOf([0, 0, 0], box[1], new Matrix4().multiplyMatrices(m, local));
      out.push({ ...base, part: t.name, name: t.pieces ? `${t.name} (piece ${i + 1})` : t.name, thin: Math.min(...box[1]) * 2 <= THIN, obb });
    });
  }
  const hw = new Map(plan.hardware.map((h) => [h.id, h]));
  for (const it of plan.items) {
    if (it.kind !== "hw" || it.wall) continue;
    const h = hw.get(it.ref)!;
    if (h.kind !== "runner") continue;
    const m = holder(it, world);
    // drawn as a 20 x 8 rail with a 4 x 4.5 lip on top (src/engine/drawable.ts): 20 wide, 12.5 out of the face, len long
    out.push({ name: h.name, part: h.name, owner: (it as HwItem).parent ?? it.key, moved: !!it.parent && moves.has(it.parent), thin: false, soft: false, runner: true, obb: obbOf([0, 6.25, 0], [10, 6.25, h.len / 2], m) });
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

/** Pairs of solids that run through each other; with `moves`, only pairs where something moved. */
function clashes(plan: Plan, moves?: Map<string, Matrix4>): string[] {
  const s = solids(plan, moves);
  const found = new Set<string>();
  for (let i = 0; i < s.length; i++)
    for (let j = i + 1; j < s.length; j++) {
      const a = s[i], b = s[j];
      if (a.owner === b.owner || a.soft || b.soft || (a.runner && b.runner) || meant(a.part, b.part)) continue;
      if (moves && !a.moved && !b.moved) continue;
      const touchA = shrunk(a.obb, (h) => h.subScalar(TOUCH / 2).max(new Vector3()));
      const touchB = shrunk(b.obb, (h) => h.subScalar(TOUCH / 2).max(new Vector3()));
      if (!touchA.intersectsOBB(touchB)) continue;
      // a thin board whose edges reach into another part: test again with GROOVE mm off its edges
      const thin = [a, b].find((x) => x.thin);
      if (thin) {
        const other = thin === a ? touchB : touchA;
        const inner = shrunk(thin.obb, (h) => new Vector3(h.x <= THIN / 2 ? h.x : Math.max(0, h.x - GROOVE), h.y <= THIN / 2 ? h.y : Math.max(0, h.y - GROOVE), h.z <= THIN / 2 ? h.z : Math.max(0, h.z - GROOVE)));
        if (!inner.intersectsOBB(other)) continue;
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
function openClashes(plan: Plan): string[] {
  const opens = plan.opens ?? [];
  const names = new Map(plan.items.filter((i): i is PartItem => i.kind === "part").map((p) => [p.key, plan.parts.find((t) => t.id === p.ref)!.name]));
  const found = new Set<string>();
  const states = opens.map((o) => [o]);
  if (opens.length > 1) states.push(opens);
  for (const st of states) {
    const moves = new Map(st.flatMap((o) => o.parts.map((k) => [k, openMatrix(o)] as const)));
    const label = st.length > 1 ? "all open" : `${names.get(st[0].parts[0])} open`;
    for (const c of clashes(plan, moves)) found.add(`${label}: ${c}`);
  }
  return [...found];
}

const PIN = 5; // mm a fitting's fixing point may sit off its part's surface: a bolt head on a washer
/** Fittings whose fixing point is off their part and off anything else (a runner's screws sit on the runner): they
 *  hang in the air in X-ray. */
function floating(plan: Plan): string[] {
  const hw = new Map(plan.hardware.map((h) => [h.id, h]));
  const all = solids(plan, undefined, true).map((x) => shrunk(x.obb, (h) => h.addScalar(PIN)));
  // spacers and leg cups are something to sit on too: drawn as a cylinder `len` out of the face
  const world = new Map(plan.items.filter((i): i is PartItem => i.kind === "part").map((p) => [p.key, new Matrix4().compose(new Vector3(...p.final.pos), quat(p.final.rot), new Vector3(1, 1, 1))]));
  for (const it of plan.items) {
    if (it.kind !== "hw") continue;
    const h = hw.get(it.ref)!;
    if (h.kind === "spacer") all.push(obbOf([0, h.len / 2, 0], [h.dia / 2 + PIN, h.len / 2 + PIN, h.dia / 2 + PIN], holder(it, world)));
  }
  const types = new Map(plan.parts.map((t) => [t.id, t]));
  const parts = new Map(plan.items.filter((i): i is PartItem => i.kind === "part").map((p) => [p.key, p]));
  const found = new Set<string>();
  for (const it of plan.items) {
    if (it.kind !== "hw" || !it.parent || it.wall) continue;
    const t = types.get(parts.get(it.parent)!.ref)!;
    const pieces = t.pieces ?? [{ shape: t.shape, size: t.size, pos: [0, 0, 0] as Vec3 }];
    const p = new Vector3(...it.pos);
    const on = pieces.some((pc) => {
      // the whole bounding box of round and shaped pieces: this asks "on it", not "through it"
      const half = new Vector3(...pc.size).multiplyScalar(0.5).addScalar(PIN);
      const local = p.clone().sub(new Vector3(...pc.pos)).applyQuaternion(quat((pc as PartPiece).rot).invert());
      return Math.abs(local.x) <= half.x && Math.abs(local.y) <= half.y && Math.abs(local.z) <= half.z;
    });
    const world = p.clone().applyMatrix4(new Matrix4().compose(new Vector3(...parts.get(it.parent)!.final.pos), quat(parts.get(it.parent)!.final.rot), new Vector3(1, 1, 1)));
    if (!on && !all.some((o) => o.containsPoint(world))) found.add(`floating: ${hw.get(it.ref)!.name} off the ${t.name}` + (WHY ? ` at [${it.pos.map((v) => v.toFixed(1)).join(", ")}] in its frame, the part ${t.size.join(" x ")}${t.pieces ? ` in ${t.pieces.length} pieces: ${t.pieces.map((pc) => `${pc.shape} ${pc.size.map((v) => Math.round(v)).join("x")} at ${pc.pos.map((v) => Math.round(v)).join(",")}`).join("; ")}` : ""}` : ""));
  }
  return [...found];
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : undefined;
const slugs = only
  ? [only]
  : args.includes("--jysk")
    ? decodeRows(JYSK_ROWS).map((r) => r.slug ?? baseSlug(r.name, r.variant))
    : PRODUCTS.map((p) => p.slug);

let bad = 0;
for (const slug of slugs) {
  const spec = catalogSpec(slug);
  if (!spec) continue;
  const plan = buildPlan(spec);
  const list = [...clashes(plan), ...openClashes(plan), ...floating(plan)];
  if (!list.length) continue;
  bad++;
  for (const c of list) console.log(`FAIL ${slug}: ${c}`);
}
console.log(`${slugs.length - bad} of ${slugs.length} guides have no clashes, closed or open, and no floating fittings`);
if (bad) process.exit(1);

